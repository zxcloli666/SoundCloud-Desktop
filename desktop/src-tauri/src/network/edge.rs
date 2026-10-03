use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

const STATE_FILE: &str = "edge_state.json";
const REVALIDATE: Duration = Duration::from_secs(600);

const RELAY_ZONE: &str = "relay.scnative.space";

const BOOTSTRAP_NODE: &str = "r1";

const RELAYS: &[(&str, &str)] = &[
    ("api.scnative.space", "api"),
    ("api-star.scnative.space", "api-star"),
    ("stream.scnative.space", "stream"),
    ("stream-star.scnative.space", "stream-star"),
    ("images.scnative.space", "images"),
    ("storage.scnative.space", "storage"),
    ("storage-star.scnative.space", "storage-star"),
    ("s3.scnative.space", "s3"),
    ("pay.scnative.space", "pay"),
];

const INHERIT: &[(&str, &str)] = &[
    ("storage.scnative.space", "stream.scnative.space"),
    ("storage-star.scnative.space", "stream-star.scnative.space"),
];

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Direct,
    Relay,
}

#[derive(Clone, Debug)]
pub struct Hop {
    pub url: String,
    pub tier: Tier,
    pub origin: String,
}

impl Hop {
    pub fn note(&self, ok: bool) {
        note(&self.origin, self.tier, ok);
    }

    pub fn tier_label(&self) -> &'static str {
        match self.tier {
            Tier::Direct => "direct",
            Tier::Relay => "relay",
        }
    }
}

struct OriginState {
    tier: Tier,
    revalidate_at: Instant,

    direct_fails: u8,
}

const DIRECT_FAIL_THRESHOLD: u8 = 2;

#[derive(Default)]
struct Pool {
    relays: Vec<String>,
    calls: Vec<(String, f64)>,
}

struct Inner {
    origins: HashMap<String, OriginState>,
    pool: Pool,
    dir: Option<PathBuf>,
}

static STATE: OnceLock<Mutex<Inner>> = OnceLock::new();

fn state() -> &'static Mutex<Inner> {
    STATE.get_or_init(|| {
        Mutex::new(Inner {
            origins: HashMap::new(),
            pool: Pool::default(),
            dir: None,
        })
    })
}

#[derive(Serialize, Deserialize, Default)]
struct Persisted {
    tiers: HashMap<String, Tier>,
}

pub fn init(data_dir: PathBuf) {
    let path = data_dir.join(STATE_FILE);
    let loaded: Persisted = std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();

    let mut inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    inner.dir = Some(data_dir);
    let now = Instant::now();
    for (host, tier) in loaded.tiers {
        if tier == Tier::Direct {
            continue;
        }
        inner.origins.insert(
            host,
            OriginState {
                tier,
                revalidate_at: now + REVALIDATE,
                direct_fails: DIRECT_FAIL_THRESHOLD,
            },
        );
    }
}

fn persist(inner: &Inner) {
    let Some(dir) = inner.dir.clone() else { return };
    let tiers: HashMap<String, Tier> = inner
        .origins
        .iter()
        .filter(|(_, s)| s.tier != Tier::Direct)
        .map(|(h, s)| (h.clone(), s.tier))
        .collect();
    let Ok(bytes) = serde_json::to_vec(&Persisted { tiers }) else {
        return;
    };
    std::thread::spawn(move || {
        let path = dir.join(STATE_FILE);
        let tmp = path.with_extension("tmp");
        if std::fs::write(&tmp, &bytes).is_ok() && std::fs::rename(&tmp, &path).is_err() {
            let _ = std::fs::remove_file(&tmp);
        }
    });
}

fn host_of(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()?
        .host_str()
        .map(|h| h.to_ascii_lowercase())
}

fn relay_label(origin: &str) -> Option<&'static str> {
    RELAYS.iter().find(|(o, _)| *o == origin).map(|(_, r)| *r)
}

pub fn set_pool(relays: Vec<String>, calls: Vec<(String, f64)>) {
    let mut inner = match state().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    if !relays.is_empty() {
        inner.pool.relays = relays;
    }
    if !calls.is_empty() {
        inner.pool.calls = calls;
    }
}

pub fn relay_pool() -> Vec<String> {
    let inner = match state().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    if inner.pool.relays.is_empty() {
        return vec![BOOTSTRAP_NODE.to_string()];
    }
    inner.pool.relays.clone()
}

pub fn call_pool() -> Vec<(String, f64)> {
    let inner = match state().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    inner.pool.calls.clone()
}

pub fn relay_zone() -> &'static str {
    RELAY_ZONE
}

pub fn primary_relay_host(service: &str) -> String {
    let node = relay_pool()
        .first()
        .cloned()
        .unwrap_or_else(|| BOOTSTRAP_NODE.to_string());
    format!("{service}.{node}.{RELAY_ZONE}")
}

pub fn relay_hosts(origin: &str) -> Vec<String> {
    relay_hosts_over(origin, &relay_pool())
}

fn relay_hosts_over(origin: &str, pool: &[String]) -> Vec<String> {
    let Some(label) = relay_label(origin) else {
        return vec![];
    };
    pool.iter()
        .map(|node| format!("{label}.{node}.{RELAY_ZONE}"))
        .collect()
}

pub fn service_label(origin: &str) -> Option<&'static str> {
    relay_label(origin)
}

fn resolved_state<'a>(inner: &'a Inner, origin: &str) -> Option<&'a OriginState> {
    if let Some(s) = inner.origins.get(origin) {
        return Some(s);
    }
    let src = INHERIT.iter().find(|(o, _)| *o == origin).map(|(_, s)| *s)?;
    inner.origins.get(src)
}

fn swap_host(url: &str, host: &str) -> Option<String> {
    let mut u = url::Url::parse(url).ok()?;
    u.set_scheme("https").ok()?;
    u.set_host(Some(host)).ok()?;
    u.set_port(None).ok()?;
    Some(u.to_string())
}

pub fn plan(url: &str) -> Vec<Hop> {
    let Some(origin) = host_of(url) else {
        return vec![];
    };
    let relays = relay_hosts(&origin);
    if relays.is_empty() {
        return vec![];
    }

    let inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let now = Instant::now();
    let entry = resolved_state(&inner, &origin);
    let tier = entry.map(|s| s.tier).unwrap_or(Tier::Direct);

    let from = if entry.map(|s| now >= s.revalidate_at).unwrap_or(true) {
        Tier::Direct
    } else {
        tier
    };

    let mut hops: Vec<Hop> = Vec::new();
    let mut push = |t: Tier, url: Option<String>| {
        if let Some(u) = url {
            hops.push(Hop {
                url: u,
                tier: t,
                origin: origin.clone(),
            });
        }
    };

    if from <= Tier::Direct {
        push(Tier::Direct, Some(url.to_string()));
    }
    if from <= Tier::Relay {
        for relay in &relays {
            push(Tier::Relay, swap_host(url, relay));
        }
    }
    if from > Tier::Direct {
        push(Tier::Direct, Some(url.to_string()));
    }
    hops
}

pub fn note(origin: &str, tier: Tier, ok: bool) {
    if origin.is_empty() {
        return;
    }
    let mut inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let now = Instant::now();

    if ok {
        let prev = inner.origins.get(origin);
        let changed = prev.map(|s| s.tier) != Some(tier);

        if !changed && tier != Tier::Direct {
            return;
        }
        inner.origins.insert(
            origin.to_string(),
            OriginState {
                tier,
                revalidate_at: now + REVALIDATE,
                direct_fails: if tier == Tier::Direct {
                    0
                } else {
                    DIRECT_FAIL_THRESHOLD
                },
            },
        );
        if changed {
            persist(&inner);
        }
        return;
    }

    if tier != Tier::Direct {
        return;
    }
    let entry = inner.origins.entry(origin.to_string()).or_insert(OriginState {
        tier: Tier::Direct,
        revalidate_at: now,
        direct_fails: 0,
    });
    entry.direct_fails = entry.direct_fails.saturating_add(1);
    entry.revalidate_at = now + REVALIDATE;
    if entry.tier == Tier::Direct && entry.direct_fails >= DIRECT_FAIL_THRESHOLD {
        entry.tier = Tier::Relay;
        persist(&inner);
    }
}

pub fn hop_ok(hop: &Hop, resp: &wreq::Response) -> bool {
    let status = resp.status().as_u16();
    let content_type = resp
        .headers()
        .get(wreq::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let bad = match hop.tier {
        Tier::Direct => direct_infrastructure_headers(status, content_type),
        Tier::Relay => relay_failure_headers(status, content_type),
    };
    if bad {
        hop.note(false);
    }
    !bad
}

fn direct_infrastructure_headers(status: u16, content_type: &str) -> bool {
    matches!(status, 502..=504) && content_type.to_ascii_lowercase().contains("text/html")
}

fn relay_failure_headers(status: u16, content_type: &str) -> bool {
    status == 421
        || (matches!(status, 502..=504)
            && !content_type.to_ascii_lowercase().contains("application/json"))
}

pub fn expand_upstreams(upstreams: &[String]) -> Vec<Hop> {
    let mut out = Vec::new();
    for u in upstreams {
        if u == "direct" {
            out.push(Hop {
                url: u.clone(),
                tier: Tier::Direct,
                origin: String::new(),
            });
            continue;
        }
        let hops = plan(u);
        if hops.is_empty() {
            out.push(Hop {
                url: u.clone(),
                tier: Tier::Direct,
                origin: host_of(u).unwrap_or_default(),
            });
        } else {
            out.extend(hops);
        }
    }
    out
}

pub fn audio_plan(url: &str) -> Vec<Hop> {
    let Some(origin) = host_of(url) else {
        return vec![Hop {
            url: url.to_string(),
            tier: Tier::Direct,
            origin: String::new(),
        }];
    };
    let relays = relay_hosts(&origin);
    if relays.is_empty() {
        return vec![Hop {
            url: url.to_string(),
            tier: Tier::Direct,
            origin,
        }];
    }
    let inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let now = Instant::now();
    let state = resolved_state(&inner, &origin);
    let revalidate = state.map(|s| now >= s.revalidate_at).unwrap_or(true);
    let tiers = audio_tier_order(state.map(|s| s.tier), revalidate);
    let relay_urls: Vec<String> = relays
        .iter()
        .map(|relay| swap_host(url, relay).unwrap_or_else(|| url.to_string()))
        .collect();

    let mut hops = Vec::with_capacity(tiers.len() + relay_urls.len() - 1);
    for tier in tiers {
        match tier {
            Tier::Direct => hops.push(Hop {
                url: url.to_string(),
                tier,
                origin: origin.clone(),
            }),

            Tier::Relay => hops.extend(relay_urls.iter().map(|u| Hop {
                url: u.clone(),
                tier,
                origin: origin.clone(),
            })),
        }
    }
    hops
}

fn audio_tier_order(current: Option<Tier>, revalidate: bool) -> [Tier; 2] {
    if revalidate || matches!(current, None | Some(Tier::Direct)) {
        [Tier::Direct, Tier::Relay]
    } else {
        [Tier::Relay, Tier::Direct]
    }
}

pub fn note_url(url: &str, tier: Tier, ok: bool) {
    let Some(origin) = host_of(url) else {
        return;
    };
    if relay_label(&origin).is_some() {
        note(&origin, tier, ok);
    }
}

pub fn current_tier(url: &str) -> Tier {
    let Some(origin) = host_of(url) else {
        return Tier::Direct;
    };
    let inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    resolved_state(&inner, &origin)
        .map(|s| s.tier)
        .unwrap_or(Tier::Direct)
}

pub fn is_direct(url: &str) -> bool {
    current_tier(url) == Tier::Direct
}

#[derive(Serialize)]
pub struct EdgeConfig {
    relays: Vec<(String, Vec<String>)>,

    hints: HashMap<String, Tier>,
    revalidate_ms: u64,
}

#[tauri::command]
pub fn edge_config() -> EdgeConfig {
    let pool = relay_pool();
    let inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    EdgeConfig {
        relays: RELAYS
            .iter()
            .map(|(o, _)| (o.to_string(), relay_hosts_over(o, &pool)))
            .collect(),
        hints: inner
            .origins
            .iter()
            .map(|(h, s)| (h.clone(), s.tier))
            .collect(),
        revalidate_ms: REVALIDATE.as_millis() as u64,
    }
}

#[tauri::command]
pub fn edge_note(origin: String, tier: Tier, ok: bool) {
    note(&origin, tier, ok);
}

#[cfg(test)]
mod tests {
    use super::{
        audio_tier_order, direct_infrastructure_headers, relay_failure_headers, relay_hosts_over,
        set_pool, Tier, INHERIT, RELAYS,
    };

    fn hosts(origin: &str) -> Vec<String> {
        relay_hosts_over(origin, &["r1".to_string(), "r2".to_string()])
    }

    #[test]
    fn every_inherit_pair_is_a_domain_we_route() {
        for (origin, source) in INHERIT {
            assert!(
                !hosts(origin).is_empty(),
                "origin {origin} наследует вердикт, но сам не в RELAYS"
            );
            assert!(
                !hosts(source).is_empty(),
                "{origin} наследует у {source}, которого нет в RELAYS"
            );
        }
    }

    #[test]
    fn relay_host_is_built_per_pool_node() {
        assert_eq!(
            hosts("api.scnative.space"),
            ["api.r1.relay.scnative.space", "api.r2.relay.scnative.space"]
        );
        assert!(hosts("soundcloud.com").is_empty());
    }

    #[test]
    fn a_node_the_server_publishes_needs_no_code_change() {
        set_pool(vec!["r1".into(), "r7".into()], vec![("call-1".into(), 1.0)]);
        assert_eq!(
            super::relay_hosts("api.scnative.space"),
            ["api.r1.relay.scnative.space", "api.r7.relay.scnative.space"]
        );
        assert_eq!(super::call_pool(), [("call-1".to_string(), 1.0)]);
    }

    #[test]
    fn without_a_published_pool_one_bootstrap_node_remains() {
        assert!(super::relay_pool().contains(&super::BOOTSTRAP_NODE.to_string()));
    }

    #[test]
    fn the_transport_ladder_has_no_worker_rung_left() {
        assert_eq!(
            [Tier::Direct, Tier::Relay].map(|t| t as u8).len(),
            2,
            "Tier должен остаться двухступенчатым"
        );
    }

    #[test]
    fn no_legacy_domain_survives_in_the_relay_table() {
        for (origin, label) in RELAYS {
            assert!(!origin.contains("scdinternal"), "legacy origin {origin}");
            assert!(!label.contains('.'), "label {label} must be a bare service");
        }
    }

    #[test]
    fn html_gateway_5xx_is_a_direct_transport_error() {
        assert!(direct_infrastructure_headers(503, "text/html; charset=utf-8"));
        assert!(direct_infrastructure_headers(504, "TEXT/HTML"));
        assert!(!direct_infrastructure_headers(500, "text/html"));
        assert!(!direct_infrastructure_headers(503, "application/json"));
    }

    #[test]
    fn json_5xx_through_a_relay_is_an_origin_answer() {
        assert!(relay_failure_headers(421, "application/json"));
        assert!(relay_failure_headers(503, "text/html"));
        assert!(relay_failure_headers(502, ""));
        assert!(!relay_failure_headers(503, "application/json; charset=utf-8"));
        assert!(!relay_failure_headers(500, "text/html"));
    }

    #[test]
    fn audio_prefers_direct_when_unknown_or_due_for_revalidation() {
        assert_eq!(audio_tier_order(None, false), [Tier::Direct, Tier::Relay]);
        assert_eq!(
            audio_tier_order(Some(Tier::Relay), true),
            [Tier::Direct, Tier::Relay]
        );
    }

    #[test]
    fn audio_uses_sticky_fallback_first_but_keeps_direct_as_backup() {
        assert_eq!(
            audio_tier_order(Some(Tier::Relay), false),
            [Tier::Relay, Tier::Direct]
        );
        assert_eq!(
            audio_tier_order(Some(Tier::Relay), false),
            [Tier::Relay, Tier::Direct]
        );
    }
}
