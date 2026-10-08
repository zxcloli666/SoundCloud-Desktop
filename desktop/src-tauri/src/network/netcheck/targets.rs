use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use futures_util::future::join_all;

use super::model::{
    AppProbe, DnsAnswer, DohProbe, Internet, PhaseProbe, Remote, TargetCheck, TargetId, Tone,
};
use super::paths::millis;
use super::phases::{self, Budget, Tls};
use super::verdict;
use crate::network::dns::{self, doh};
use crate::network::edge;
use crate::network::fail::{self, Fail, FailKind};
use crate::network::system_proxy;

const HEALTH_PATH: &str = "/health";
const HTTPS_PORT: u16 = 443;
const SYSTEM_DNS_BUDGET: Duration = Duration::from_secs(3);
const APP_TIMEOUT: Duration = Duration::from_secs(8);
const APP_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const TARGET_CAP: Duration = Duration::from_secs(20);
const EXTERNAL_TIMEOUT: Duration = Duration::from_secs(3);
const RELAY_TARGETS: usize = 4;
const DOH_SAMPLE_HOST: &str = "api.scnative.space";
const STATUS_VERDICT_URL: &str = "https://status.soundcloud-desktop.fun/api/verdict";
const CORE: [(TargetId, &str); 4] = [
    (TargetId::Main, "api.scnative.space"),
    (TargetId::Star, "api-star.scnative.space"),
    (TargetId::Storage, "storage.scnative.space"),
    (TargetId::Images, "images.scnative.space"),
];

pub struct Target {
    pub id: TargetId,
    pub node: Option<String>,
    pub host: String,
}

impl Target {
    pub fn pending(&self) -> TargetCheck {
        TargetCheck::pending(self.id, self.node.clone(), self.host.clone())
    }
}

pub fn targets() -> Vec<Target> {
    let core = CORE.iter().map(|(id, host)| Target {
        id: *id,
        node: None,
        host: (*host).to_string(),
    });
    let relays = edge::relay_pool()
        .into_iter()
        .take(RELAY_TARGETS)
        .map(|node| Target {
            id: TargetId::Relay,
            host: format!("api.{node}.{}", edge::relay_zone()),
            node: Some(node),
        });
    core.chain(relays).collect()
}

pub fn client() -> Option<&'static wreq::Client> {
    static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            system_proxy::follow(sc_fingerprint::builder(None))
                .connect_timeout(APP_CONNECT_TIMEOUT)
                .pool_max_idle_per_host(0)
                .build()
                .ok()
        })
        .as_ref()
}

pub async fn check(target: &Target, app: Option<&wreq::Client>) -> TargetCheck {
    match tokio::time::timeout(TARGET_CAP, inspect(target, app)).await {
        Ok(check) => check,
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

async fn inspect(target: &Target, app: Option<&wreq::Client>) -> TargetCheck {
    let host = target.host.as_str();
    let url = format!("https://{host}{HEALTH_PATH}");
    let proxied = system_proxy::proxied(&url);
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
        manual(host, probe_ip),
        manual(host, second_ip),
        app_path(app, &url)
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
    };
    check.cells = verdict::cells(&check);
    check
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

async fn manual(host: &str, ip: Option<IpAddr>) -> Option<PhaseProbe> {
    let ip = ip?;
    let tls = Tls::public()?;
    Some(phases::probe(host, ip, HTTPS_PORT, HEALTH_PATH, tls, Budget::default()).await)
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
    Some(app_probe(client?, url).await)
}

async fn app_probe(client: &wreq::Client, url: &str) -> AppProbe {
    let started = Instant::now();
    match client.get(url).timeout(APP_TIMEOUT).send().await {
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
    join_all(doh::PROVIDERS.iter().map(|provider| async move {
        let started = Instant::now();
        let result = doh::query_with(provider, DOH_SAMPLE_HOST).await;
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

pub async fn internet(client: &wreq::Client) -> Internet {
    let checks = [
        reachable(
            client,
            "https://www.gstatic.com/generate_204",
            |status, _| status == 204,
        ),
        reachable(
            client,
            "https://detectportal.firefox.com/success.txt",
            |status, body| status == 200 && body.starts_with("success"),
        ),
        reachable(
            client,
            "https://www.cloudflare.com/cdn-cgi/trace",
            |status, _| status == 200,
        ),
    ];
    if join_all(checks).await.into_iter().any(|ok| ok) {
        Internet::Online
    } else {
        Internet::Offline
    }
}

async fn reachable(client: &wreq::Client, url: &str, valid: fn(u16, &str) -> bool) -> bool {
    let attempt = async {
        match client.get(url).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let body = response.text().await.unwrap_or_default();
                valid(status, &body)
            }
            Err(error) => fail::of_wreq(&error) == FailKind::TlsCert,
        }
    };
    tokio::time::timeout(EXTERNAL_TIMEOUT, attempt)
        .await
        .unwrap_or(false)
}

pub async fn remote(client: &wreq::Client) -> Remote {
    let attempt = async {
        let response = client.get(STATUS_VERDICT_URL).send().await.ok()?;
        if !response.status().is_success() {
            return None;
        }
        response.json::<serde_json::Value>().await.ok()
    };
    let payload = tokio::time::timeout(EXTERNAL_TIMEOUT, attempt)
        .await
        .ok()
        .flatten();
    remote_of(payload.as_ref())
}

pub fn remote_of(payload: Option<&serde_json::Value>) -> Remote {
    let main = payload
        .and_then(|payload| payload.get("roles"))
        .and_then(|roles| roles.get("main"))
        .and_then(serde_json::Value::as_str);
    match main {
        Some("operational" | "degraded") => Remote::Up,
        Some("down") => Remote::Down,
        _ => Remote::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{Target, remote_of, targets, total};
    use crate::network::netcheck::model::{AppProbe, PhaseProbe, Remote, TargetId, Tone};

    #[test]
    fn the_core_hosts_come_first_and_relays_are_capped() {
        let list = targets();
        let ids: Vec<TargetId> = list.iter().take(4).map(|target| target.id).collect();
        assert_eq!(
            ids,
            [
                TargetId::Main,
                TargetId::Star,
                TargetId::Storage,
                TargetId::Images
            ]
        );
        assert!(list.len() <= 8);
        let relay = list
            .iter()
            .find(|target| target.id == TargetId::Relay)
            .unwrap();
        let node = relay.node.as_deref().unwrap();
        assert_eq!(relay.host, format!("api.{node}.relay.scnative.space"));
    }

    #[test]
    fn a_pending_target_shows_pending_cells() {
        let target = Target {
            id: TargetId::Main,
            node: None,
            host: "api.scnative.space".to_string(),
        };
        assert_eq!(target.pending().cells, [Tone::Pending; 4]);
    }

    #[test]
    fn the_status_page_verdict_is_read_like_the_frontend_does() {
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "operational"}}))),
            Remote::Up
        );
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "degraded"}}))),
            Remote::Up
        );
        assert_eq!(
            remote_of(Some(&json!({"roles": {"main": "down"}}))),
            Remote::Down
        );
        assert_eq!(remote_of(Some(&json!({"roles": {}}))), Remote::Unknown);
        assert_eq!(remote_of(None), Remote::Unknown);
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
}
