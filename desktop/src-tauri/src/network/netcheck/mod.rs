mod der;
mod env;
#[cfg(test)]
mod fixture;
pub mod model;
pub mod paths;
mod phases;
mod report;
mod scrub;
mod store;
mod targets;
mod tcpinfo;
mod verdict;

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use futures_util::future::{BoxFuture, FutureExt, Shared};
use futures_util::stream::{self, StreamExt};
use tauri::Emitter;
use tokio::runtime::Handle;

use self::model::{
    AppInfo, EdgeSnapshot, Hint, Internet, NetCheckUpdate, NetReport, REPORT_VERSION, Remote,
    TargetId, Trigger, Verdict,
};
use self::paths::{millis, now_ms};
use crate::app::diagnostics;
use crate::network::{edge, fetch};
use crate::rt::AppHandle;

const EVENT: &str = "netcheck:update";
const AUTO_GAP: Duration = Duration::from_secs(600);
const AUTO_GAP_MAX: Duration = Duration::from_secs(3600);
const PARALLEL: usize = 6;
const RECENT_EVENTS: usize = 40;
const MAX_REASON: usize = 32;
const ENV_BUDGET: Duration = Duration::from_secs(5);

type Flight = Shared<BoxFuture<'static, Option<NetReport>>>;

#[derive(Default)]
struct Memory {
    reports: Vec<NetReport>,
    flight: Option<Flight>,
    finished_ms: Option<u64>,
}

struct Checker {
    app: AppHandle,
    runtime: Handle,
    path: PathBuf,
    memory: Mutex<Memory>,
}

static CHECKER: OnceLock<Checker> = OnceLock::new();

impl Checker {
    fn memory(&self) -> MutexGuard<'_, Memory> {
        self.memory
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
    }

    fn emit(&self, running: bool, report: &NetReport) {
        let update = NetCheckUpdate {
            running,
            report: report.clone(),
        };
        let _ = self.app.emit(EVENT, update);
    }
}

pub fn init(app: AppHandle, runtime: Handle, data_dir: PathBuf) {
    let path = store::path(&data_dir);
    let checker = Checker {
        app,
        runtime: runtime.clone(),
        path: path.clone(),
        memory: Mutex::new(Memory::default()),
    };
    if CHECKER.set(checker).is_err() {
        return;
    }
    runtime.spawn(async move {
        let loaded = store::load(&path).await;
        let Some(checker) = CHECKER.get() else { return };
        let mut memory = checker.memory();
        if memory.reports.is_empty() {
            memory.finished_ms = loaded
                .first()
                .map(|report| report.at_ms + u64::from(report.duration_ms));
            memory.reports = loaded;
        }
    });
}

pub fn auto(reason: &str) {
    let Some(checker) = CHECKER.get() else { return };
    {
        let memory = checker.memory();
        let gap = auto_gap(&memory.reports).as_millis() as u64;
        let recent = memory
            .finished_ms
            .is_some_and(|at| now_ms().saturating_sub(at) < gap);
        let running = memory
            .flight
            .as_ref()
            .is_some_and(|flight| flight.peek().is_none());
        if running || recent {
            return;
        }
    }
    let _ = start(Trigger::Auto, Some(reason.to_string()));
}

fn auto_gap(reports: &[NetReport]) -> Duration {
    let Some(last) = reports.first() else {
        return AUTO_GAP;
    };
    let streak = reports
        .iter()
        .take_while(|report| {
            report.trigger == Trigger::Auto
                && report.verdict == last.verdict
                && report.hint == last.hint
        })
        .count();
    let doublings = streak.saturating_sub(1).min(3) as u32;
    AUTO_GAP.saturating_mul(1 << doublings).min(AUTO_GAP_MAX)
}

fn start(trigger: Trigger, reason: Option<String>) -> Option<Flight> {
    let checker = CHECKER.get()?;
    let mut memory = checker.memory();
    if let Some(flight) = memory
        .flight
        .as_ref()
        .filter(|flight| flight.peek().is_none())
    {
        return Some(flight.clone());
    }
    let task = checker.runtime.spawn(run(trigger, reason));
    let flight = async move { task.await.ok() }.boxed().shared();
    memory.flight = Some(flight.clone());
    Some(flight)
}

fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        install: crate::app::updater::install_label(),
    }
}

fn edge_snapshot() -> EdgeSnapshot {
    EdgeSnapshot {
        pins: edge::pins(),
        pool: edge::relay_pool(),
    }
}

async fn run(trigger: Trigger, reason: Option<String>) -> NetReport {
    let started = Instant::now();
    let list = targets::targets();
    let mut report = NetReport {
        version: REPORT_VERSION,
        at_ms: now_ms(),
        trigger,
        reason,
        duration_ms: 0,
        app: app_info(),
        verdict: Verdict::Checking,
        hint: Hint::None,
        remote: Remote::Unknown,
        internet: Internet::Unknown,
        targets: list.iter().map(targets::Target::pending).collect(),
        doh: Vec::new(),
        env: None,
        edge: edge_snapshot(),
        recent: paths::recent(RECENT_EVENTS),
    };
    let checker = CHECKER.get();
    if let Some(checker) = checker {
        checker.emit(true, &report);
    }
    let client = fetch::client();
    let collect = async {
        let mut checks = stream::iter(list.into_iter().enumerate())
            .map(|(at, target)| async move { (at, targets::check(&target, client, trigger).await) })
            .buffer_unordered(PARALLEL);
        while let Some((at, mut check)) = checks.next().await {
            scrub::target(&mut check);
            report.targets[at] = check;
            if let Some(checker) = checker {
                checker.emit(true, &report);
            }
        }
    };
    let environment = tokio::time::timeout(ENV_BUDGET, env::detect());
    let providers = async {
        if targets::direct_allowed(trigger) {
            targets::doh_providers().await
        } else {
            Vec::new()
        }
    };
    let ((), doh, env) = tokio::join!(collect, providers, environment);
    report.doh = doh;
    report.env = env.ok();
    let any_ok = report.targets.iter().any(|target| target.ok);
    let main_ok = report
        .targets
        .iter()
        .any(|target| target.id == TargetId::Main && target.ok);
    let (internet, remote) = tokio::join!(
        async {
            match client {
                Some(client) if !any_ok => targets::internet(client).await,
                _ if any_ok => Internet::Online,
                _ => Internet::Unknown,
            }
        },
        async {
            match client {
                Some(client) if !main_ok => targets::remote(client).await,
                _ => Remote::Unknown,
            }
        }
    );
    report.internet = internet;
    report.remote = remote;
    report.verdict = verdict::verdict(&report.targets, internet, remote);
    report.hint = verdict::hint(report.verdict, report.env.as_ref(), &report.targets);
    report.recent = paths::recent(RECENT_EVENTS);
    report.edge = edge_snapshot();
    report.duration_ms = millis(started.elapsed());
    scrub::report(&mut report);
    finish(&report).await;
    report
}

async fn finish(report: &NetReport) {
    let Some(checker) = CHECKER.get() else { return };
    let bytes = {
        let mut memory = checker.memory();
        let mut reports = std::mem::take(&mut memory.reports);
        reports.insert(0, report.clone());
        let (kept, bytes) = store::bounded(reports);
        memory.reports = kept;
        memory.finished_ms = Some(now_ms());
        memory.flight = None;
        bytes
    };
    store::save(&checker.path, bytes).await;
    for line in report::log_lines(report) {
        diagnostics::log("INFO", line);
    }
    checker.emit(false, report);
}

fn reason_of(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(MAX_REASON)
        .collect()
}

#[tauri::command]
pub async fn net_check_run() -> Result<NetReport, String> {
    let flight = start(Trigger::Manual, None).ok_or("network check is not ready")?;
    flight
        .await
        .ok_or_else(|| "network check failed".to_string())
}

#[tauri::command]
pub fn net_check_auto(reason: String) {
    auto(&reason_of(&reason));
}

#[tauri::command]
pub fn net_check_last() -> Option<NetReport> {
    CHECKER.get()?.memory().reports.first().cloned()
}

#[tauri::command]
pub fn net_check_report_text() -> Result<String, String> {
    net_check_last()
        .map(|report| report::text(&report))
        .ok_or_else(|| "no network check yet".to_string())
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::fixture::sample;
    use super::model::{Hint, NetReport, Trigger, Verdict};
    use super::{auto_gap, reason_of};

    fn auto(verdict: Verdict) -> NetReport {
        NetReport {
            trigger: Trigger::Auto,
            verdict,
            hint: Hint::Zapret,
            ..sample(0)
        }
    }

    #[test]
    fn auto_runs_back_off_while_the_verdict_stays_the_same() {
        let minutes = |reports: &[NetReport]| auto_gap(reports).as_secs() / 60;
        assert_eq!(minutes(&[]), 10);
        let same = auto(Verdict::RelayOnly);
        assert_eq!(minutes(&[same.clone()]), 10);
        assert_eq!(minutes(&[same.clone(), same.clone()]), 20);
        assert_eq!(minutes(&[same.clone(), same.clone(), same.clone()]), 40);
        assert_eq!(minutes(&vec![same.clone(); 5]), 60);
        let changed = [auto(Verdict::Reset), same.clone(), same.clone()];
        assert_eq!(minutes(&changed), 10);
        let manual = [same.clone(), sample(0), same.clone()];
        assert_eq!(minutes(&manual), 10);
        let rehinted = NetReport {
            hint: Hint::None,
            ..same.clone()
        };
        assert_eq!(minutes(&[same, rehinted]), 10);
        assert!(auto_gap(&vec![auto(Verdict::Offline); 5]) <= Duration::from_secs(3600));
    }

    #[test]
    fn a_reason_from_the_frontend_is_short_and_plain() {
        assert_eq!(reason_of("main-down"), "main-down");
        assert_eq!(reason_of("x?session_id=1&y"), "xsessionid1y");
        assert_eq!(reason_of(&"a".repeat(100)).len(), 32);
    }
}
