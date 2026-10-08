use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::app::diagnostics;

const STATE_FILE: &str = "edge_state.json";
const CONFIG_EVENT: &str = "edge:config";
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

    pub fn note_delivered(&self, bytes: u64) {
        note_delivered(&self.origin, self.tier, bytes);
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
    until: Instant,
    direct_fails: u8,
    relay_wins: u8,
    last_at: Instant,
}

impl OriginState {
    fn new(now: Instant) -> Self {
        Self {
            tier: Tier::Direct,
            until: now,
            direct_fails: 0,
            relay_wins: 0,
            last_at: now,
        }
    }

    fn pinned_until(until: Instant, now: Instant) -> Self {
        Self {
            tier: Tier::Relay,
            until,
            direct_fails: 0,
            relay_wins: 0,
            last_at: now,
        }
    }

    fn pinned(&self, now: Instant) -> bool {
        self.tier == Tier::Relay && now < self.until
    }

    fn refresh(&mut self, now: Instant) {
        if self.tier == Tier::Relay && now >= self.until {
            self.tier = Tier::Direct;
            self.clear();
        } else if now.saturating_duration_since(self.last_at) >= REVALIDATE {
            self.clear();
        }
        self.last_at = now;
    }

    fn clear(&mut self) {
        self.direct_fails = 0;
        self.relay_wins = 0;
    }

    fn pin(&mut self, now: Instant) -> Change {
        self.tier = Tier::Relay;
        self.until = now + REVALIDATE;
        self.clear();
        Change::Pinned
    }

    fn unpin(&mut self) -> Change {
        self.tier = Tier::Direct;
        self.clear();
        Change::Unpinned
    }

    fn due(&self) -> bool {
        self.direct_fails >= DIRECT_FAIL_THRESHOLD || self.relay_wins >= RELAY_WIN_THRESHOLD
    }
}

const DIRECT_FAIL_THRESHOLD: u8 = 2;
const RELAY_WIN_THRESHOLD: u8 = 2;

const PROVEN_BYTES: u64 = 64 * 1024;

#[derive(Clone, Copy, Debug)]
enum Event {
    DirectFailed,
    DirectAnswered,
    DirectDelivered(u64),
    RelayWon,
    RelayFailed,
}

impl Event {
    fn of(tier: Tier, ok: bool) -> Self {
        match (tier, ok) {
            (Tier::Direct, false) => Self::DirectFailed,
            (Tier::Direct, true) => Self::DirectAnswered,
            (Tier::Relay, true) => Self::RelayWon,
            (Tier::Relay, false) => Self::RelayFailed,
        }
    }

    fn counts(self) -> bool {
        matches!(self, Self::DirectFailed | Self::RelayWon)
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Change {
    None,
    Pinned,
    Unpinned,
}

#[derive(Default)]
struct Pool {
    relays: Vec<String>,
    calls: Vec<(String, f64)>,
}

#[derive(Default)]
struct Inner {
    origins: HashMap<String, OriginState>,
    pool: Pool,
    dir: Option<PathBuf>,
}

impl Inner {
    fn apply(&mut self, origin: &str, event: Event, now: Instant) -> Change {
        if !event.counts() && !self.origins.contains_key(origin) {
            return Change::None;
        }
        let state = self
            .origins
            .entry(origin.to_string())
            .or_insert_with(|| OriginState::new(now));
        state.refresh(now);
        match event {
            Event::DirectFailed => state.direct_fails = state.direct_fails.saturating_add(1),
            Event::DirectAnswered => state.relay_wins = 0,
            Event::DirectDelivered(bytes) => {
                state.clear();
                if bytes >= PROVEN_BYTES && state.tier == Tier::Relay {
                    return state.unpin();
                }
            }
            Event::RelayWon => state.relay_wins = state.relay_wins.saturating_add(1),
            Event::RelayFailed => {}
        }
        if state.tier == Tier::Direct && state.due() {
            return state.pin(now);
        }
        Change::None
    }

    fn conclude(&mut self, origin: &str, tier: Tier, now: Instant) -> Change {
        if tier == Tier::Direct && !self.origins.contains_key(origin) {
            return Change::None;
        }
        let state = self
            .origins
            .entry(origin.to_string())
            .or_insert_with(|| OriginState::new(now));
        state.refresh(now);
        match (tier, state.tier) {
            (Tier::Relay, Tier::Direct) => state.pin(now),
            (Tier::Direct, Tier::Relay) => state.unpin(),
            _ => Change::None,
        }
    }

    fn pinned(&self, origin: &str, now: Instant) -> bool {
        resolved_state(self, origin).is_some_and(|s| s.pinned(now))
    }
}

static STATE: OnceLock<Mutex<Inner>> = OnceLock::new();

fn state() -> &'static Mutex<Inner> {
    STATE.get_or_init(|| Mutex::new(Inner::default()))
}

#[derive(Serialize, Deserialize, Default, Debug, PartialEq, Eq)]
struct Persisted {
    #[serde(default)]
    pins: HashMap<String, u64>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

fn snapshot(inner: &Inner, now: Instant, now_ms: u64) -> Persisted {
    let pins = inner
        .origins
        .iter()
        .filter(|(_, s)| s.pinned(now))
        .map(|(host, s)| {
            let left = s.until.saturating_duration_since(now).as_millis() as u64;
            (host.clone(), now_ms.saturating_add(left))
        })
        .collect();
    Persisted { pins }
}

fn restore(inner: &mut Inner, persisted: Persisted, now: Instant, now_ms: u64) {
    for (host, until_ms) in persisted.pins {
        if until_ms <= now_ms {
            continue;
        }
        let left = Duration::from_millis(until_ms - now_ms).min(REVALIDATE);
        inner
            .origins
            .insert(host, OriginState::pinned_until(now + left, now));
    }
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
    restore(&mut inner, loaded, Instant::now(), now_ms());
}

fn persist(inner: &Inner) {
    let Some(dir) = inner.dir.clone() else { return };
    let Ok(bytes) = serde_json::to_vec(&snapshot(inner, Instant::now(), now_ms())) else {
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

pub fn routed_origins() -> impl Iterator<Item = &'static str> {
    RELAYS.iter().map(|(origin, _)| *origin)
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
    let from = if inner.pinned(&origin, Instant::now()) {
        Tier::Relay
    } else {
        Tier::Direct
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
    record(origin, |inner, now| {
        inner.apply(origin, Event::of(tier, ok), now)
    });
}

pub fn note_delivered(origin: &str, tier: Tier, bytes: u64) {
    if tier == Tier::Direct {
        record(origin, |inner, now| {
            inner.apply(origin, Event::DirectDelivered(bytes), now)
        });
    }
}

fn settle(origin: &str, tier: Tier) {
    record(origin, |inner, now| inner.conclude(origin, tier, now));
}

fn record(origin: &str, step: impl FnOnce(&mut Inner, Instant) -> Change) {
    if origin.is_empty() {
        return;
    }
    let change = {
        let mut inner = match state().lock() {
            Ok(g) => g,
            Err(e) => e.into_inner(),
        };
        let change = step(&mut inner, Instant::now());
        if change != Change::None {
            persist(&inner);
        }
        change
    };
    match change {
        Change::Pinned => diagnostics::log(
            "INFO",
            format!(
                "[Edge] {origin} -> relay for {} min",
                REVALIDATE.as_secs() / 60
            ),
        ),
        Change::Unpinned => diagnostics::log("INFO", format!("[Edge] {origin} -> direct")),
        Change::None => {}
    }
}

pub fn hop_ok(hop: &Hop, resp: &wreq::Response) -> bool {
    let content_type = resp
        .headers()
        .get(wreq::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let bad = transport_failure(hop.tier, resp.status().as_u16(), content_type);
    if bad {
        hop.note(false);
    }
    !bad
}

fn transport_failure(tier: Tier, status: u16, content_type: &str) -> bool {
    let gateway = matches!(status, 502..=504);
    let gateway_page = gateway && content_type.to_ascii_lowercase().contains("text/html");
    match tier {
        Tier::Direct => gateway_page,
        Tier::Relay => status == 421 || gateway_page || (gateway && content_type.trim().is_empty()),
    }
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
    let tiers = audio_tier_order(inner.pinned(&origin, Instant::now()));
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

fn audio_tier_order(pinned: bool) -> [Tier; 2] {
    if pinned {
        [Tier::Relay, Tier::Direct]
    } else {
        [Tier::Direct, Tier::Relay]
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

pub fn note_url_delivered(url: &str, tier: Tier, bytes: u64) {
    let Some(origin) = host_of(url) else {
        return;
    };
    if relay_label(&origin).is_some() {
        note_delivered(&origin, tier, bytes);
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
    if inner.pinned(&origin, Instant::now()) {
        Tier::Relay
    } else {
        Tier::Direct
    }
}

pub fn is_direct(url: &str) -> bool {
    current_tier(url) == Tier::Direct
}

pub fn direct_first(url: &str) -> bool {
    plan(url).first().is_none_or(|hop| hop.tier == Tier::Direct)
}

#[derive(Clone, Serialize)]
pub struct EdgeConfig {
    relays: Vec<(String, Vec<String>)>,

    hints: HashMap<String, Tier>,
    revalidate_in_ms: HashMap<String, u64>,
    revalidate_ms: u64,
}

#[tauri::command]
pub fn edge_config() -> EdgeConfig {
    let pool = relay_pool();
    let inner = match state().lock() {
        Ok(g) => g,
        Err(e) => e.into_inner(),
    };
    let now = Instant::now();
    EdgeConfig {
        relays: RELAYS
            .iter()
            .map(|(o, _)| (o.to_string(), relay_hosts_over(o, &pool)))
            .collect(),
        hints: inner
            .origins
            .iter()
            .map(|(h, s)| {
                let tier = if s.pinned(now) {
                    Tier::Relay
                } else {
                    Tier::Direct
                };
                (h.clone(), tier)
            })
            .collect(),
        revalidate_in_ms: inner
            .origins
            .iter()
            .map(|(h, s)| {
                let left = if s.pinned(now) {
                    s.until.saturating_duration_since(now)
                } else {
                    Duration::ZERO
                };
                (h.clone(), left.as_millis() as u64)
            })
            .collect(),
        revalidate_ms: REVALIDATE.as_millis() as u64,
    }
}

pub fn announce(app: &crate::rt::AppHandle) {
    app.emit(CONFIG_EVENT, edge_config()).ok();
}

#[tauri::command]
pub fn edge_note(origin: String, tier: Tier, ok: bool) {
    if ok {
        settle(&origin, tier);
    } else {
        note(&origin, tier, false);
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::{
        Change, Event, INHERIT, Inner, PROVEN_BYTES, Persisted, RELAYS, REVALIDATE, Tier,
        audio_tier_order, relay_hosts_over, restore, set_pool, snapshot, transport_failure,
    };

    const ORIGIN: &str = "stream.scnative.space";

    fn tier(inner: &Inner) -> Option<Tier> {
        inner.origins.get(ORIGIN).map(|s| s.tier)
    }

    fn pinned(inner: &Inner, now: Instant) -> bool {
        inner.pinned(ORIGIN, now)
    }

    fn apply(inner: &mut Inner, events: &[Event], now: Instant) -> Vec<Change> {
        events
            .iter()
            .map(|event| inner.apply(ORIGIN, *event, now))
            .collect()
    }

    fn pinned_inner(now: Instant) -> Inner {
        let mut inner = Inner::default();
        apply(&mut inner, &[Event::RelayWon, Event::RelayWon], now);
        assert!(pinned(&inner, now));
        inner
    }

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
        assert!(transport_failure(
            Tier::Direct,
            503,
            "text/html; charset=utf-8"
        ));
        assert!(transport_failure(Tier::Direct, 504, "TEXT/HTML"));
        assert!(!transport_failure(Tier::Direct, 500, "text/html"));
        assert!(!transport_failure(Tier::Direct, 503, "application/json"));
        assert!(!transport_failure(Tier::Direct, 421, "text/plain"));
    }

    #[test]
    fn an_origin_timeout_through_a_relay_is_the_server_answer() {
        assert!(!transport_failure(
            Tier::Relay,
            504,
            "text/plain; charset=utf-8"
        ));
        assert!(transport_failure(Tier::Relay, 504, "text/html"));
        assert!(transport_failure(Tier::Relay, 502, "text/html"));
        assert!(transport_failure(Tier::Relay, 421, ""));
    }

    #[test]
    fn json_5xx_through_a_relay_is_an_origin_answer() {
        assert!(transport_failure(Tier::Relay, 421, "application/json"));
        assert!(transport_failure(Tier::Relay, 503, "text/html"));
        assert!(transport_failure(Tier::Relay, 502, ""));
        assert!(!transport_failure(
            Tier::Relay,
            503,
            "application/json; charset=utf-8"
        ));
        assert!(!transport_failure(Tier::Relay, 500, "text/html"));
    }

    #[test]
    fn audio_prefers_direct_unless_the_origin_is_pinned() {
        assert_eq!(audio_tier_order(false), [Tier::Direct, Tier::Relay]);
    }

    #[test]
    fn audio_uses_the_pinned_relay_first_but_keeps_direct_as_backup() {
        assert_eq!(audio_tier_order(true), [Tier::Relay, Tier::Direct]);
    }

    #[test]
    fn answered_headers_do_not_hide_bodies_that_keep_breaking() {
        let mut inner = Inner::default();
        let now = Instant::now();
        apply(
            &mut inner,
            &[
                Event::DirectFailed,
                Event::DirectAnswered,
                Event::DirectFailed,
            ],
            now,
        );
        assert_eq!(tier(&inner), Some(Tier::Relay));
    }

    #[test]
    fn a_small_direct_answer_keeps_the_origin_on_the_relay() {
        let now = Instant::now();
        let mut inner = pinned_inner(now);
        apply(
            &mut inner,
            &[
                Event::DirectAnswered,
                Event::DirectDelivered(PROVEN_BYTES - 1),
            ],
            now,
        );
        assert_eq!(tier(&inner), Some(Tier::Relay));
    }

    #[test]
    fn a_whole_direct_body_brings_the_origin_back() {
        let now = Instant::now();
        let mut inner = pinned_inner(now);
        assert_eq!(
            inner.apply(ORIGIN, Event::DirectDelivered(PROVEN_BYTES), now),
            Change::Unpinned
        );
        assert_eq!(tier(&inner), Some(Tier::Direct));
        inner.apply(ORIGIN, Event::DirectFailed, now);
        assert_eq!(tier(&inner), Some(Tier::Direct));
    }

    #[test]
    fn failures_far_apart_do_not_add_up() {
        let mut inner = Inner::default();
        let now = Instant::now();
        inner.apply(ORIGIN, Event::DirectFailed, now);
        inner.apply(
            ORIGIN,
            Event::DirectFailed,
            now + REVALIDATE + Duration::from_secs(1),
        );
        assert_eq!(tier(&inner), Some(Tier::Direct));
    }

    #[test]
    fn a_route_pinned_to_the_relay_is_not_tried_direct_before_revalidation() {
        super::note("s3.scnative.space", Tier::Relay, true);
        assert!(super::direct_first("https://s3.scnative.space/a"));
        super::note("s3.scnative.space", Tier::Relay, true);
        assert!(!super::direct_first("https://s3.scnative.space/a"));
        assert!(super::direct_first("https://example.org/a"));
    }

    #[test]
    fn the_webview_learns_how_long_a_relay_pin_still_holds() {
        super::note("pay.scnative.space", Tier::Relay, true);
        super::note("pay.scnative.space", Tier::Relay, true);
        let config = super::edge_config();
        assert_eq!(config.hints.get("pay.scnative.space"), Some(&Tier::Relay));
        let left = config.revalidate_in_ms["pay.scnative.space"];
        assert!(left > 0 && left <= REVALIDATE.as_millis() as u64);
    }

    #[test]
    fn the_webview_hears_direct_for_an_origin_that_is_not_pinned() {
        super::note("api-star.scnative.space", Tier::Relay, true);
        let config = super::edge_config();
        assert_eq!(
            config.hints.get("api-star.scnative.space"),
            Some(&Tier::Direct)
        );
        assert_eq!(config.revalidate_in_ms["api-star.scnative.space"], 0);
        assert!(super::is_direct("https://api-star.scnative.space/x"));
    }

    #[test]
    fn a_relay_body_never_counts_as_proof_for_direct() {
        super::note("images.scnative.space", Tier::Relay, true);
        super::note("images.scnative.space", Tier::Relay, true);
        super::note_delivered("images.scnative.space", Tier::Relay, PROVEN_BYTES * 4);
        assert_eq!(
            super::current_tier("https://images.scnative.space/a.jpg"),
            Tier::Relay
        );
    }

    #[test]
    fn a_single_relay_win_does_not_pin() {
        let mut inner = Inner::default();
        let now = Instant::now();
        assert_eq!(apply(&mut inner, &[Event::RelayWon], now), [Change::None]);
        assert!(!pinned(&inner, now));
    }

    #[test]
    fn two_relay_wins_in_a_row_pin() {
        let mut inner = Inner::default();
        let now = Instant::now();
        assert_eq!(
            apply(&mut inner, &[Event::RelayWon, Event::RelayWon], now),
            [Change::None, Change::Pinned]
        );
        assert!(pinned(&inner, now));
        assert!(!pinned(&inner, now + REVALIDATE));
    }

    #[test]
    fn a_direct_answer_between_relay_wins_breaks_the_streak() {
        let mut inner = Inner::default();
        let now = Instant::now();
        apply(
            &mut inner,
            &[Event::RelayWon, Event::DirectAnswered, Event::RelayWon],
            now,
        );
        assert!(!pinned(&inner, now));
        apply(
            &mut inner,
            &[Event::DirectDelivered(10), Event::RelayWon],
            now,
        );
        assert!(!pinned(&inner, now));
    }

    #[test]
    fn a_complete_direct_answer_breaks_the_failure_streak() {
        let mut inner = Inner::default();
        let now = Instant::now();
        apply(
            &mut inner,
            &[
                Event::DirectFailed,
                Event::DirectDelivered(10),
                Event::DirectFailed,
            ],
            now,
        );
        assert_eq!(tier(&inner), Some(Tier::Direct));
    }

    #[test]
    fn relay_failures_never_pin() {
        let mut inner = Inner::default();
        let now = Instant::now();
        apply(&mut inner, &[Event::RelayFailed, Event::RelayFailed], now);
        assert!(inner.origins.is_empty());
        apply(
            &mut inner,
            &[Event::RelayWon, Event::RelayFailed, Event::RelayFailed],
            now,
        );
        assert!(!pinned(&inner, now));
    }

    #[test]
    fn an_expired_pin_needs_two_new_failures() {
        let now = Instant::now();
        let mut inner = pinned_inner(now);
        let later = now + REVALIDATE + Duration::from_secs(1);
        assert_eq!(
            inner.apply(ORIGIN, Event::DirectFailed, later),
            Change::None
        );
        assert!(!pinned(&inner, later));
        assert_eq!(
            inner.apply(ORIGIN, Event::DirectFailed, later),
            Change::Pinned
        );
        assert!(pinned(&inner, later));
    }

    #[test]
    fn repeated_wins_do_not_extend_a_pin() {
        let now = Instant::now();
        let mut inner = pinned_inner(now);
        let until = inner.origins[ORIGIN].until;
        let later = now + REVALIDATE / 2;
        assert_eq!(
            apply(
                &mut inner,
                &[
                    Event::RelayWon,
                    Event::RelayWon,
                    Event::DirectFailed,
                    Event::DirectFailed
                ],
                later,
            ),
            [Change::None; 4]
        );
        assert_eq!(inner.origins[ORIGIN].until, until);
        assert!(!pinned(&inner, now + REVALIDATE));
        assert_eq!(
            inner.apply(ORIGIN, Event::DirectFailed, now + REVALIDATE),
            Change::None
        );
    }

    #[test]
    fn a_webview_conclusion_pins_at_once() {
        let mut inner = Inner::default();
        let now = Instant::now();
        assert_eq!(inner.conclude(ORIGIN, Tier::Relay, now), Change::Pinned);
        assert!(pinned(&inner, now));
        assert_eq!(inner.conclude(ORIGIN, Tier::Relay, now), Change::None);
        assert_eq!(inner.conclude(ORIGIN, Tier::Direct, now), Change::Unpinned);
        assert!(!pinned(&inner, now));
        assert_eq!(inner.conclude(ORIGIN, Tier::Direct, now), Change::None);
    }

    #[test]
    fn a_storage_origin_follows_the_pin_of_its_stream_origin() {
        let mut inner = Inner::default();
        let now = Instant::now();
        inner.conclude("stream.scnative.space", Tier::Relay, now);
        assert!(inner.pinned("storage.scnative.space", now));
        assert!(!inner.pinned("storage-star.scnative.space", now));
    }

    #[test]
    fn a_restart_keeps_only_the_remaining_pin_time() {
        let start = Instant::now();
        let now = start + REVALIDATE;
        let now_ms = 1_000_000_000;
        let mut inner = pinned_inner(now);
        inner.conclude("api.scnative.space", Tier::Relay, start);
        inner.conclude("pay.scnative.space", Tier::Relay, start + REVALIDATE / 2);
        let saved = snapshot(&inner, now, now_ms);
        assert_eq!(saved.pins.len(), 2);
        assert_eq!(saved.pins[ORIGIN], now_ms + REVALIDATE.as_millis() as u64);
        assert!(!saved.pins.contains_key("api.scnative.space"));

        let mut pins = saved.pins;
        pins.insert("s3.scnative.space".into(), now_ms - 1);
        pins.insert(
            "images.scnative.space".into(),
            now_ms + 100 * REVALIDATE.as_millis() as u64,
        );
        let later = now + Duration::from_secs(60);
        let mut restored = Inner::default();
        restore(&mut restored, Persisted { pins }, later, now_ms + 60_000);
        assert!(!restored.origins.contains_key("s3.scnative.space"));
        assert!(restored.pinned(ORIGIN, later));
        assert!(!restored.pinned(ORIGIN, now + REVALIDATE));
        assert!(restored.pinned("pay.scnative.space", later));
        assert!(!restored.pinned("pay.scnative.space", now + REVALIDATE / 2));
        assert!(restored.pinned("images.scnative.space", later));
        assert!(!restored.pinned("images.scnative.space", later + REVALIDATE));
        assert_eq!(restored.origins[ORIGIN].direct_fails, 0);
    }

    #[test]
    fn an_old_state_file_loads_as_no_pins() {
        let old: Persisted =
            serde_json::from_str(r#"{"tiers":{"api.scnative.space":"relay"}}"#).unwrap();
        assert!(old.pins.is_empty());
        let mut inner = Inner::default();
        restore(&mut inner, old, Instant::now(), 1);
        assert!(inner.origins.is_empty());
    }
}
