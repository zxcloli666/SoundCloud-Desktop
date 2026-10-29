use std::path::PathBuf;

use chrono::{TimeZone, Utc};
use serde::Serialize;
use serde_json::{Value, json};

use super::app_info::AppInfo;
use super::attempt::{Attempt, AttemptJson};
use super::caps;
use super::errors::{ErrorEntry, now_iso};
use super::session::SessionJson;
use crate::app::log_sink::redact;

pub const MAX_BYTES: usize = 256 * 1024;
const LOG_LINES: usize = 150;
const LOG_READ_BYTES: u64 = 1024 * 1024;
const DROP_STEP: usize = 10;

pub struct Inputs {
    pub app: AppInfo,
    pub session: SessionJson,
    pub trigger: Trigger,
    pub netcheck: Option<String>,
    pub log_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Trigger {
    Manual,
    Render,
    Netcheck,
}

#[derive(Serialize)]
struct Bundle {
    kind: &'static str,
    v: u8,
    at: String,
    app: AppInfo,
    session: SessionJson,
    trigger: Value,
    attempts: Vec<AttemptJson>,
    errors: Vec<ErrorEntry>,
    netcheck: Option<String>,
    log_tail: Vec<String>,
}

fn iso(at_ms: u64) -> String {
    Utc.timestamp_millis_opt(at_ms as i64)
        .single()
        .map_or_else(now_iso, |at| {
            at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
        })
}

fn attempt_json(attempt: Attempt) -> AttemptJson {
    AttemptJson {
        at: iso(attempt.at_ms),
        trace: attempt.trace,
        span: attempt.span,
        debug: attempt.debug,
        service: attempt.service,
        method: attempt.method,
        path: caps::cut(&redact(&attempt.path), caps::PATH),
        hop: attempt.hop,
        status: attempt.status,
        ms: attempt.ms,
        error: attempt
            .error
            .map(|error| caps::cut(&redact(&error), caps::ERROR)),
        bytes: attempt.bytes,
    }
}

fn redacted(mut entry: ErrorEntry) -> ErrorEntry {
    entry.message = caps::cut(&redact(&entry.message), caps::MESSAGE);
    entry.stack = entry
        .stack
        .map(|stack| caps::cut(&redact(&stack), caps::STACK));
    entry.component_stack = entry
        .component_stack
        .map(|stack| caps::cut(&redact(&stack), caps::COMPONENT_STACK));
    for value in entry.context.values_mut() {
        *value = caps::cut(&redact(value), caps::CONTEXT_VALUE);
    }
    entry
}

fn log_tail(path: &PathBuf) -> Vec<String> {
    use std::io::{Read, Seek, SeekFrom};
    let Ok(mut file) = std::fs::File::open(path) else {
        return Vec::new();
    };
    let size = file.metadata().map_or(0, |meta| meta.len());
    let _ = file.seek(SeekFrom::Start(size.saturating_sub(LOG_READ_BYTES)));
    let mut bytes = Vec::new();
    let _ = file.read_to_end(&mut bytes);
    let text = String::from_utf8_lossy(&bytes);
    let mut lines: Vec<String> = text
        .lines()
        .filter(|line| {
            line.contains("[WARN]")
                || line.contains("[ERROR]")
                || line.contains("[PANIC]")
                || line.contains("SESSION STARTED")
                || line.contains("SoundCloud Desktop ")
        })
        .map(|line| caps::cut(&redact(line), caps::LOG_LINE))
        .collect();
    let extra = lines.len().saturating_sub(LOG_LINES);
    lines.drain(..extra);
    lines
}

fn trigger_json(kind: Trigger, errors: &[ErrorEntry]) -> Value {
    let error = (kind == Trigger::Render)
        .then(|| errors.iter().rposition(|entry| entry.kind == "render"))
        .flatten();
    json!({ "kind": kind, "error": error })
}

pub fn build(inputs: Inputs, attempts: Vec<Attempt>, errors: Vec<ErrorEntry>) -> Vec<u8> {
    let errors: Vec<ErrorEntry> = errors.into_iter().map(redacted).collect();
    let mut bundle = Bundle {
        kind: "scd-diagnostics",
        v: 1,
        at: now_iso(),
        app: inputs.app,
        session: inputs.session,
        trigger: trigger_json(inputs.trigger, &errors),
        attempts: attempts.into_iter().map(attempt_json).collect(),
        errors,
        netcheck: inputs
            .netcheck
            .map(|text| caps::cut(&redact(&text), caps::NETCHECK)),
        log_tail: inputs.log_path.as_ref().map(log_tail).unwrap_or_default(),
    };
    loop {
        let bytes = serde_json::to_vec(&bundle).unwrap_or_default();
        if bytes.len() <= MAX_BYTES {
            return bytes;
        }
        if !bundle.attempts.is_empty() {
            let step = DROP_STEP.min(bundle.attempts.len());
            bundle.attempts.drain(..step);
        } else if !bundle.log_tail.is_empty() {
            let step = DROP_STEP.min(bundle.log_tail.len());
            bundle.log_tail.drain(..step);
        } else {
            return bytes;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::diag::session::Route;
    use crate::network::edge::Tier;
    use crate::network::netcheck::model::Role;

    fn inputs() -> Inputs {
        Inputs {
            app: AppInfo {
                version: "8.6.1".into(),
                os: "macos".into(),
                os_version: "15.0".into(),
                arch: "aarch64".into(),
                install: "dmg".into(),
                locale: "ru".into(),
                id: "a1b2c3d4e5f6".into(),
            },
            session: SessionJson {
                uptime_s: 5,
                logged_in: true,
                premium: false,
                quality: "hq".into(),
                route: Route {
                    main: "relay:r2".into(),
                    star: "direct".into(),
                },
            },
            trigger: Trigger::Render,
            netcheck: Some("net text".into()),
            log_path: None,
        }
    }

    fn attempt(error_len: usize) -> Attempt {
        Attempt {
            at_ms: 1_700_000_000_000,
            trace: format!("{}{}", "1".repeat(16), "2".repeat(16)),
            span: "3".repeat(16),
            debug: true,
            service: "stream",
            method: "GET".into(),
            path: "/stream/soundcloud:tracks:123?quality=hq&session_id=secret99".into(),
            hop: "r2".into(),
            origin: "stream.scnative.dev".into(),
            tier: Tier::Relay,
            role: Role::Primary,
            source: "api",
            status: 0,
            ms: 10012,
            error: Some("x".repeat(error_len)),
            fail: None,
            bytes: 0,
        }
    }

    fn render_error() -> ErrorEntry {
        ErrorEntry {
            at: now_iso(),
            kind: "render".into(),
            message: "bad Bearer abcdefghijk".into(),
            stack: None,
            component_stack: None,
            trace: None,
            fingerprint: "0123456789abcdef".into(),
            count: 1,
            context: BTreeMap::from([("route".to_string(), "/library".to_string())]),
        }
    }

    #[test]
    fn the_bundle_has_the_documented_shape() {
        let bytes = build(inputs(), vec![attempt(10)], vec![render_error()]);
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["kind"], "scd-diagnostics");
        assert_eq!(json["v"], 1);
        assert_eq!(json["app"]["id"], "a1b2c3d4e5f6");
        assert_eq!(json["session"]["route"]["main"], "relay:r2");
        assert_eq!(json["trigger"]["kind"], "render");
        assert_eq!(json["trigger"]["error"], 0);
        assert_eq!(json["netcheck"], "net text");
        assert_eq!(json["errors"][0]["context"]["route"], "/library");
        let first = &json["attempts"][0];
        assert_eq!(
            first["trace"],
            format!("{}{}", "1".repeat(16), "2".repeat(16))
        );
        assert_eq!(first["span"].as_str().unwrap().len(), 16);
        assert_eq!(first["service"], "stream");
        assert_eq!(first["hop"], "r2");
        assert!(first["at"].as_str().unwrap().ends_with('Z'));
        assert!(json["log_tail"].as_array().unwrap().is_empty());
    }

    #[test]
    fn secrets_are_redacted() {
        let text =
            String::from_utf8(build(inputs(), vec![attempt(10)], vec![render_error()])).unwrap();
        assert!(!text.contains("secret99"));
        assert!(text.contains("session_id=***"));
        assert!(!text.contains("abcdefghijk"));
        assert!(text.contains("tracks:123"));
    }

    #[test]
    fn the_cap_drops_the_oldest_attempts_first() {
        let attempts: Vec<Attempt> = (0..300)
            .map(|index| {
                let mut each = attempt(2000);
                each.status = index;
                each
            })
            .collect();
        let bytes = build(inputs(), attempts, vec![render_error()]);
        assert!(bytes.len() <= MAX_BYTES);
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let kept = json["attempts"].as_array().unwrap();
        assert!(!kept.is_empty() && kept.len() < 300);
        assert_eq!(kept.last().unwrap()["status"], 299);
        assert_eq!(json["errors"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn the_log_tail_keeps_warnings_and_headers() {
        let dir = std::env::temp_dir().join(format!("scd-tail-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("desktop.log");
        let mut lines = vec!["[t] [INFO] SoundCloud Desktop 8.6.1 on macos aarch64".to_string()];
        for number in 0..200 {
            lines.push(format!("[t] [INFO] noise {number}"));
            lines.push(format!("[t] [WARN] problem {number} ?token=abc123"));
        }
        std::fs::write(&path, lines.join("\n")).unwrap();
        let tail = log_tail(&path);
        assert_eq!(tail.len(), LOG_LINES);
        assert!(tail.iter().all(|line| line.contains("[WARN]")));
        assert!(tail.last().unwrap().contains("problem 199"));
        assert!(tail.iter().all(|line| !line.contains("abc123")));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
