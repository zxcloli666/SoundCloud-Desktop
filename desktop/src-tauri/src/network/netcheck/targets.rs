use std::net::IpAddr;
use std::time::{Duration, Instant};

use futures_util::future::join_all;

use super::model::{
    AppProbe, DnsAnswer, DohProbe, PhaseProbe, TargetCheck, TargetId, Tone, Trigger,
};
use super::paths::millis;
use super::phases::{self, Budget, Tls};
use super::route::{self, API};
use super::verdict;
use crate::network::dns::{self, doh};
use crate::network::edge;
use crate::network::fail::{Fail, FailKind, Phase};
use crate::network::system_proxy;

const HEALTH_PATH: &str = "/health";
const ROOT_PATH: &str = "/";
const HTTPS_PORT: u16 = 443;
const SYSTEM_DNS_BUDGET: Duration = Duration::from_secs(6);
const APP_TIMEOUT: Duration = Duration::from_secs(15);
const APP_RETRY_FLOOR: Duration = Duration::from_secs(3);
const TARGET_CAP: Duration = Duration::from_secs(30);
const CAP_MARGIN: Duration = Duration::from_secs(1);
const RELAY_TARGETS: usize = 4;
const PRO_TARGETS: usize = 2;
const CALL_TARGETS: usize = 3;
const SOUNDCLOUD_HOST: &str = "api-v2.soundcloud.com";

pub struct Target {
    pub id: TargetId,
    pub node: Option<String>,
    pub host: String,
}

impl Target {
    pub fn pending(&self) -> TargetCheck {
        TargetCheck::pending(self.id, self.node.clone(), self.host.clone())
    }

    pub fn ours(&self) -> bool {
        self.id != TargetId::SoundCloud
    }

    fn path(&self) -> &'static str {
        if self.id == TargetId::SoundCloud {
            ROOT_PATH
        } else {
            HEALTH_PATH
        }
    }
}

pub fn targets(call: bool) -> Vec<Target> {
    let calls = if call { edge::call_pool() } else { Vec::new() };
    listed(edge::relay_pool(), edge::pro_hosts(), calls)
}

fn listed(relays: Vec<String>, pros: Vec<String>, calls: Vec<(String, f64)>) -> Vec<Target> {
    let relays = relays.into_iter().take(RELAY_TARGETS).map(|node| Target {
        id: TargetId::Relay,
        host: format!("{node}.{}", edge::relay_zone()),
        node: Some(node),
    });
    let pros = pros.into_iter().take(PRO_TARGETS).map(|host| Target {
        id: TargetId::Pro,
        node: host.split('.').next().map(str::to_string),
        host,
    });
    let images = Target {
        id: TargetId::Images,
        node: None,
        host: edge::plain_host(edge::IMAGES),
    };
    let calls = calls
        .into_iter()
        .filter(|(_, weight)| *weight > 0.0)
        .take(CALL_TARGETS)
        .map(|(node, _)| Target {
            id: TargetId::Call,
            host: edge::call_host(&node),
            node: Some(node),
        });
    let soundcloud = Target {
        id: TargetId::SoundCloud,
        node: None,
        host: SOUNDCLOUD_HOST.to_string(),
    };
    relays
        .chain(pros)
        .chain([images])
        .chain(calls)
        .chain([soundcloud])
        .collect()
}

fn doh_sample_host() -> String {
    let node = edge::relay_pool().into_iter().next().unwrap_or_default();
    format!("{node}.{}", edge::relay_zone())
}

pub async fn check(target: &Target, app: Option<&wreq::Client>, trigger: Trigger) -> TargetCheck {
    let routed = async {
        match (target.id, &target.node) {
            (TargetId::Relay, Some(node)) => route::of(node, app).await,
            (TargetId::Pro, _) => route::through_pro(&target.host, app).await,
            _ => None,
        }
    };
    let checked = async { tokio::join!(inspect(target, app, trigger), routed) };
    match tokio::time::timeout(TARGET_CAP, checked).await {
        Ok((mut check, route)) => {
            check.ok &= route.as_ref().is_none_or(|route| route.carries(API));
            check.route = route;
            check
        }
        Err(_) => {
            let mut check = target.pending();
            check.app = Some(AppProbe {
                fail: Some(Fail::timeout_after(millis(TARGET_CAP))),
                ..AppProbe::default()
            });
            check.cells = verdict::cells(&check);
            check
        }
    }
}

async fn inspect(target: &Target, client: Option<&wreq::Client>, trigger: Trigger) -> TargetCheck {
    let started = Instant::now();
    let host = target.host.as_str();
    let path = target.path();
    let url = format!("https://{host}{path}");
    let proxied = system_proxy::proxied(&url);
    if proxied && trigger == Trigger::Auto {
        return through_proxy(target, client, &url).await;
    }
    let (system, doh) = tokio::join!(system_answer(host), doh_answer(host));
    let system_ip = system.addrs.iter().copied().find(|ip| !dns::garbage(*ip));
    let doh_ip = doh.addrs.first().copied();
    let disjoint = verdict::disjoint(&system, Some(&doh));
    let probe_ip = if proxied { None } else { system_ip.or(doh_ip) };
    let second_ip = if disjoint && system_ip.is_some() && !proxied {
        doh_ip
    } else {
        None
    };
    let (probe, doh_probe, app) = tokio::join!(
        manual(host, path, probe_ip),
        manual(host, path, second_ip),
        app_path(client, &url)
    );
    let probe = probe.map(|mut probe| {
        probe.dns_ms = if system_ip.is_some() {
            system.ms
        } else {
            doh.ms
        };
        probe
    });
    let probe_ok = probe.as_ref().map(PhaseProbe::passed);
    if disjoint && probe_ok == Some(false) {
        dns::suspect(host);
    }
    let left = TARGET_CAP.saturating_sub(started.elapsed() + CAP_MARGIN);
    let reached = probe.as_ref().is_some_and(reached);
    let app = retried(client, &url, app, reached, left).await;
    let dns = verdict::dns_state(
        &system,
        Some(&doh),
        probe_ok,
        doh_probe.as_ref().map(PhaseProbe::passed),
    );
    let ok = app
        .as_ref()
        .map_or_else(|| probe_ok.unwrap_or(false), |app| app.ok);
    let total_ms = total(probe.as_ref(), app.as_ref());
    let mut check = TargetCheck {
        id: target.id,
        node: target.node.clone(),
        host: target.host.clone(),
        proxied,
        system,
        doh: Some(doh),
        dns,
        probe,
        doh_probe,
        app,
        ok,
        cells: [Tone::Pending; 4],
        total_ms,
        volume: None,
        route: None,
    };
    check.cells = verdict::cells(&check);
    check
}

async fn through_proxy(target: &Target, app: Option<&wreq::Client>, url: &str) -> TargetCheck {
    let app = app_path(app, url).await;
    let mut check = target.pending();
    check.proxied = true;
    check.ok = app.as_ref().is_some_and(|app| app.ok);
    check.total_ms = total(None, app.as_ref());
    check.app = app;
    check.cells = verdict::cells(&check);
    check
}

pub fn direct_allowed(trigger: Trigger) -> bool {
    trigger == Trigger::Manual || !system_proxy::proxied(&format!("https://{}/", doh_sample_host()))
}

fn total(probe: Option<&PhaseProbe>, app: Option<&AppProbe>) -> Option<u32> {
    if let Some(probe) = probe.filter(|probe| probe.passed()) {
        return [
            probe.dns_ms,
            probe.tcp_ms,
            probe.tls_ms,
            probe.first_byte_ms,
        ]
        .into_iter()
        .map(|ms| ms.unwrap_or(0))
        .reduce(u32::saturating_add);
    }
    app.filter(|app| app.ok).and_then(|app| app.ms)
}

async fn manual(host: &str, path: &str, ip: Option<IpAddr>) -> Option<PhaseProbe> {
    let ip = ip?;
    let tls = Tls::public()?;
    Some(phases::probe(host, ip, HTTPS_PORT, path, tls, Budget::default()).await)
}

async fn system_answer(host: &str) -> DnsAnswer {
    let started = Instant::now();
    match tokio::time::timeout(
        SYSTEM_DNS_BUDGET,
        tokio::net::lookup_host((host, HTTPS_PORT)),
    )
    .await
    {
        Err(_) => DnsAnswer {
            fail: Some(Fail::timeout_after(millis(SYSTEM_DNS_BUDGET))),
            ..DnsAnswer::default()
        },
        Ok(Err(error)) => DnsAnswer {
            ms: Some(millis(started.elapsed())),
            fail: Some(Fail {
                detail: Some(error.to_string()),
                ..Fail::of(FailKind::Dns)
            }),
            ..DnsAnswer::default()
        },
        Ok(Ok(found)) => {
            let mut addrs: Vec<IpAddr> = Vec::new();
            for addr in found {
                if !addrs.contains(&addr.ip()) {
                    addrs.push(addr.ip());
                }
            }
            DnsAnswer {
                addrs,
                ms: Some(millis(started.elapsed())),
                ..DnsAnswer::default()
            }
        }
    }
}

async fn doh_answer(host: &str) -> DnsAnswer {
    let started = Instant::now();
    match doh::query(host).await {
        Ok(answer) => DnsAnswer {
            addrs: answer.addrs,
            ms: Some(millis(started.elapsed())),
            fail: None,
            provider: Some(answer.provider.to_string()),
        },
        Err(fail) => DnsAnswer {
            ms: Some(millis(started.elapsed())),
            fail: Some(fail),
            ..DnsAnswer::default()
        },
    }
}

async fn app_path(client: Option<&wreq::Client>, url: &str) -> Option<AppProbe> {
    Some(app_probe(client?, url, APP_TIMEOUT).await)
}

fn reached(probe: &PhaseProbe) -> bool {
    probe.passed()
        || probe.fail.as_ref().is_some_and(|fail| {
            fail.kind == FailKind::Timeout && fail.phase == Some(Phase::FirstByte)
        })
}

async fn retried(
    client: Option<&wreq::Client>,
    url: &str,
    first: Option<AppProbe>,
    reached: bool,
    left: Duration,
) -> Option<AppProbe> {
    let timed_out = first
        .as_ref()
        .and_then(|app| app.fail.as_ref())
        .is_some_and(|fail| fail.kind == FailKind::Timeout);
    match client {
        Some(client) if timed_out && reached && left >= APP_RETRY_FLOOR => {
            Some(app_probe(client, url, left.min(APP_TIMEOUT)).await)
        }
        _ => first,
    }
}

pub(super) async fn app_probe(client: &wreq::Client, url: &str, timeout: Duration) -> AppProbe {
    let started = Instant::now();
    match client.get(url).timeout(timeout).send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            AppProbe {
                ok: status < 500,
                status: Some(status),
                ms: Some(millis(started.elapsed())),
                fail: None,
            }
        }
        Err(error) => {
            let ms = millis(started.elapsed());
            AppProbe {
                ok: false,
                status: None,
                ms: Some(ms),
                fail: Some(Fail {
                    after_ms: Some(ms),
                    ..Fail::of_wreq(&error)
                }),
            }
        }
    }
}

pub async fn doh_providers() -> Vec<DohProbe> {
    let sample = &doh_sample_host();
    join_all(doh::PROVIDERS.iter().map(|provider| async move {
        let started = Instant::now();
        let result = doh::query_with(provider, sample).await;
        let ms = Some(millis(started.elapsed()));
        let fail = match result {
            Ok(answer) if !answer.addrs.is_empty() => None,
            Ok(_) => Some(Fail {
                detail: Some("no address".to_string()),
                ..Fail::of(FailKind::Dns)
            }),
            Err(fail) => Some(fail),
        };
        DohProbe {
            provider: provider.id.to_string(),
            ok: fail.is_none(),
            ms,
            fail,
        }
    }))
    .await
}

pub fn internet_seen(targets: &[TargetCheck], doh: &[DohProbe]) -> bool {
    let answered = targets.iter().any(|target| {
        target.ok
            || target
                .doh
                .as_ref()
                .is_some_and(|answer| !answer.addrs.is_empty())
    });
    answered || doh.iter().any(|probe| probe.ok)
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{
        APP_RETRY_FLOOR, APP_TIMEOUT, SYSTEM_DNS_BUDGET, TARGET_CAP, Target, app_probe, doh,
        internet_seen, listed, reached, retried, targets, total, verdict,
    };
    use crate::network::fail::{Fail, FailKind, Phase};
    use crate::network::netcheck::model::{
        AppProbe, DnsAnswer, DohProbe, PhaseProbe, TargetId, Tone,
    };
    use crate::network::netcheck::phases::Budget;
    use crate::network::netcheck::status::EXTERNAL_TIMEOUT;

    const SLOW_RTT: Duration = Duration::from_secs(2);

    fn main_target() -> Target {
        Target {
            id: TargetId::Relay,
            node: Some("r1".to_string()),
            host: "r1.relay.scnative.dev".to_string(),
        }
    }

    #[test]
    fn a_doh_answer_proves_the_internet_works() {
        let mut check = main_target().pending();
        assert!(!internet_seen(std::slice::from_ref(&check), &[]));
        check.doh = Some(DnsAnswer {
            addrs: vec!["188.165.221.195".parse().unwrap()],
            ..DnsAnswer::default()
        });
        assert!(internet_seen(std::slice::from_ref(&check), &[]));
        let provider = DohProbe {
            provider: "google".to_string(),
            ok: true,
            ms: Some(4_000),
            fail: None,
        };
        assert!(internet_seen(&[main_target().pending()], &[provider]));
    }

    #[test]
    fn a_slow_link_fits_every_budget() {
        assert!(SYSTEM_DNS_BUDGET >= SLOW_RTT * 3);
        assert!(EXTERNAL_TIMEOUT >= SLOW_RTT * 4);
        assert!(APP_TIMEOUT >= SLOW_RTT * 5);
        let budget = Budget::default();
        let probe = budget.tcp + budget.tls + budget.first_byte;
        let lookups = SYSTEM_DNS_BUDGET.max(doh::TOTAL_BUDGET);
        assert!(TARGET_CAP >= lookups + probe.max(APP_TIMEOUT));
    }

    #[test]
    fn the_check_lists_only_what_the_app_contacts() {
        let list = targets(false);
        let ids: Vec<TargetId> = list.iter().map(|target| target.id).collect();
        assert_eq!(ids.first(), Some(&TargetId::Relay));
        assert!(!ids.contains(&TargetId::Call));
        let relay = &list[0];
        let node = relay.node.as_deref().unwrap();
        assert_eq!(relay.host, format!("{node}.relay.scnative.dev"));
        let pro = list
            .iter()
            .find(|target| target.id == TargetId::Pro)
            .unwrap();
        assert_eq!(pro.node.as_deref(), Some("p1"));
        assert_eq!(pro.host, "p1.pro.scnative.dev");
        let images = list
            .iter()
            .find(|target| target.id == TargetId::Images)
            .unwrap();
        assert_eq!(images.host, "images.scnative.dev");
        let last = list.last().unwrap();
        assert_eq!(last.id, TargetId::SoundCloud);
        assert_eq!(last.host, "api-v2.soundcloud.com");
        assert!(!last.ours());
        assert_eq!(last.path(), "/");
        assert!(list.iter().filter(|target| target.ours()).all(|target| {
            [
                "relay.scnative.dev",
                "pro.scnative.dev",
                "images.scnative.dev",
            ]
            .iter()
            .any(|zone| target.host.ends_with(zone))
        }));
        assert!(list.len() <= super::RELAY_TARGETS + super::PRO_TARGETS + 2);
    }

    #[test]
    fn a_drained_call_node_is_not_checked() {
        let pool = vec![("call-1".to_string(), 1.0), ("call-9".to_string(), 0.0)];
        let calls: Vec<String> = listed(vec!["r1".to_string()], Vec::new(), pool)
            .into_iter()
            .filter(|target| target.id == TargetId::Call)
            .map(|target| target.host)
            .collect();
        assert_eq!(calls, ["call-1.scnative.dev"]);
    }

    #[test]
    fn a_pending_target_shows_pending_cells() {
        let target = main_target();
        assert_eq!(target.pending().cells, [Tone::Pending; 4]);
        assert_eq!(verdict::cells(&target.pending())[0], Tone::Skip);
    }

    #[test]
    fn the_total_adds_up_a_passed_probe_or_falls_back_to_the_app() {
        let probe = PhaseProbe {
            dns_ms: Some(5),
            tcp_ms: Some(30),
            tls_ms: Some(40),
            first_byte_ms: Some(50),
            status: Some(200),
            ..PhaseProbe::default()
        };
        assert_eq!(total(Some(&probe), None), Some(125));
        let app = AppProbe {
            ok: true,
            status: Some(200),
            ms: Some(90),
            fail: None,
        };
        let failed = PhaseProbe {
            status: None,
            ..probe
        };
        assert_eq!(total(Some(&failed), Some(&app)), Some(90));
        assert_eq!(total(None, None), None);
    }

    async fn silent_first_time() -> (String, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let accepted = Arc::new(AtomicUsize::new(0));
        let counter = accepted.clone();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                let first = counter.fetch_add(1, Ordering::SeqCst) == 0;
                tokio::spawn(async move {
                    let mut buf = [0u8; 2048];
                    let _ = socket.read(&mut buf).await;
                    if first {
                        tokio::time::sleep(Duration::from_secs(30)).await;
                        return;
                    }
                    let _ = socket
                        .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\n\r\nok")
                        .await;
                    tokio::time::sleep(Duration::from_secs(1)).await;
                });
            }
        });
        (format!("http://{addr}/health"), accepted)
    }

    #[tokio::test]
    async fn an_app_path_that_only_timed_out_is_tried_once_more_when_the_probe_passed() {
        let (url, accepted) = silent_first_time().await;
        let client = wreq::Client::builder().no_proxy().build().unwrap();
        let first = app_probe(&client, &url, Duration::from_millis(300)).await;
        assert!(!first.ok);
        assert_eq!(
            first.fail.as_ref().map(|fail| fail.kind),
            Some(FailKind::Timeout)
        );
        let room = APP_RETRY_FLOOR * 2;

        let probe_failed = retried(Some(&client), &url, Some(first.clone()), false, room).await;
        assert_eq!(probe_failed.as_ref(), Some(&first));
        let no_room = APP_RETRY_FLOOR / 2;
        let late = retried(Some(&client), &url, Some(first.clone()), true, no_room).await;
        assert_eq!(late.as_ref(), Some(&first));
        assert_eq!(accepted.load(Ordering::SeqCst), 1);

        let again = retried(Some(&client), &url, Some(first), true, room)
            .await
            .unwrap();
        assert!(again.ok, "{again:?}");
        assert_eq!(again.status, Some(200));
        assert_eq!(accepted.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn a_probe_that_got_through_the_handshake_reached_the_server() {
        let failed = |kind: FailKind, phase: Phase| PhaseProbe {
            tcp_ms: Some(1_000),
            fail: Some(Fail {
                phase: Some(phase),
                ..Fail::of(kind)
            }),
            ..PhaseProbe::default()
        };
        let passed = PhaseProbe {
            status: Some(200),
            ..PhaseProbe::default()
        };
        assert!(reached(&passed));
        assert!(reached(&failed(FailKind::Timeout, Phase::FirstByte)));
        assert!(!reached(&failed(FailKind::Timeout, Phase::Tcp)));
        assert!(!reached(&failed(FailKind::Timeout, Phase::Tls)));
        assert!(!reached(&failed(FailKind::Reset, Phase::FirstByte)));
        assert!(!reached(&PhaseProbe::default()));
    }

    #[tokio::test]
    async fn a_refused_app_path_is_not_tried_again() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/health", listener.local_addr().unwrap());
        drop(listener);
        let client = wreq::Client::builder().no_proxy().build().unwrap();
        let first = app_probe(&client, &url, Duration::from_secs(2)).await;
        assert_eq!(
            first.fail.as_ref().map(|fail| fail.kind),
            Some(FailKind::Refused)
        );
        let kept = retried(Some(&client), &url, Some(first.clone()), true, APP_TIMEOUT).await;
        assert_eq!(kept, Some(first));
    }
}
