mod config;
mod name;
mod persist;
mod plan;
mod state;

#[cfg(test)]
mod name_tests;
#[cfg(test)]
mod plan_tests;
#[cfg(test)]
mod state_tests;

use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL};
use serde::{Deserialize, Serialize};

use self::state::{Change, Event, Inner, REVALIDATE};
use crate::app::diagnostics;

pub use self::config::EdgeConfig;
pub use self::name::{
    IMAGES, Key, call_host, has_direct, key_of, key_of_host, label_of, plain_host, relay_host,
};
pub use self::plan::{audio_plan, expand_upstreams, plan, upload_plan};

const STATUS_HOST: &str = "status.getsoundcloud.app";

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Direct,
    Relay,
    Pro,
}

#[derive(Clone, Debug)]
pub struct Hop {
    pub url: String,
    pub tier: Tier,
    pub origin: String,
}

impl Hop {
    pub fn unplanned(url: &str) -> Self {
        Self {
            url: url.to_string(),
            tier: Tier::Direct,
            origin: String::new(),
        }
    }

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
            Tier::Pro => "pro",
        }
    }
}

static STATE: OnceLock<Mutex<Inner>> = OnceLock::new();

fn lock() -> MutexGuard<'static, Inner> {
    match STATE.get_or_init(|| Mutex::new(Inner::default())).lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    }
}

pub fn init(data_dir: PathBuf) {
    let loaded = persist::load(&data_dir);
    let mut inner = lock();
    inner.dir = Some(data_dir);
    persist::restore(&mut inner, loaded, Instant::now(), persist::now_ms());
}

pub fn set_pool(relays: Vec<String>, calls: Vec<(String, f64)>) {
    let mut inner = lock();
    if !relays.is_empty() {
        inner.pool.relays = relays;
    }
    if !calls.is_empty() {
        inner.pool.calls = calls;
    }
}

pub fn relay_pool() -> Vec<String> {
    lock().relay_nodes(Instant::now())
}

pub fn demote_relays(nodes: &[String], penalty: Duration) {
    lock().demote_relays(nodes, Instant::now() + penalty);
    announce_change();
}

pub fn call_pool() -> Vec<(String, f64)> {
    lock().pool.calls.clone()
}

pub fn relay_hosts(label: &str) -> Vec<String> {
    relay_pool()
        .iter()
        .map(|node| relay_host(label, node))
        .collect()
}

pub fn primary_relay_host(label: &str) -> String {
    let nodes = relay_pool();
    relay_host(
        label,
        nodes.first().map_or(state::BOOTSTRAP_NODE, String::as_str),
    )
}

pub fn relay_url(url: &str, node: &str) -> Option<String> {
    name::on_host(url, &relay_host(label_of(url)?, node))
}

pub fn direct_url(url: &str) -> Option<String> {
    let label = label_of(url).filter(|label| has_direct(label))?;
    name::on_host(url, &plain_host(label))
}

pub fn relay_zone() -> &'static str {
    name::RELAY_ZONE
}

pub fn pro_zone() -> &'static str {
    name::PRO_ZONE
}

pub fn set_pros(nodes: Vec<String>) {
    let mut inner = lock();
    if !nodes.is_empty() {
        inner.pool.pros = nodes;
    }
}

pub fn pro_hosts() -> Vec<String> {
    lock().pro_hosts()
}

pub fn set_gateway(port: u16) {
    lock().gateway_port = Some(port);
}

pub fn gateway_of(pro_host: &str) -> Option<String> {
    let inner = lock();
    let port = inner.gateway_port?;
    inner
        .pro_hosts()
        .iter()
        .any(|host| host == pro_host)
        .then(|| format!("http://127.0.0.1:{port}/pro/{pro_host}/"))
}

pub fn is_routed(url: &str) -> bool {
    label_of(url).is_some()
}

pub fn through_gateway(gateway: &str, url: &str) -> String {
    format!("{gateway}{}", BASE64_URL.encode(url))
}

pub fn zone_hosts() -> Vec<String> {
    let inner = lock();
    let nodes = inner.relay_nodes(Instant::now());
    let mut hosts: Vec<String> = nodes
        .iter()
        .flat_map(|node| {
            name::SERVICES
                .into_iter()
                .map(move |label| relay_host(label, node))
        })
        .collect();
    hosts.extend(nodes.iter().map(|node| name::node_host(node)));
    hosts.extend(inner.pro_hosts());
    hosts.extend(
        inner
            .pool
            .calls
            .iter()
            .map(|(node, _)| name::call_host(node)),
    );
    hosts.push(plain_host(name::IMAGES));
    hosts.push(STATUS_HOST.to_string());
    hosts
}

pub fn is_known_host(host: &str) -> bool {
    if host == STATUS_HOST || is_named_host(host) || pro_hosts().iter().any(|known| known == host) {
        return true;
    }
    let Some(rest) = host
        .strip_suffix(name::RELAY_ZONE)
        .and_then(|rest| rest.strip_suffix('.'))
    else {
        return false;
    };
    let (label, node) = match rest.split_once('.') {
        Some((label, node)) => (Some(label), node),
        None => (None, rest),
    };
    label.is_none_or(|label| name::SERVICES.contains(&label))
        && relay_pool().iter().any(|pooled| pooled == node)
}

pub fn is_our_host(host: &str) -> bool {
    let zoned = [name::RELAY_ZONE, name::PRO_ZONE]
        .into_iter()
        .any(|zone| name::in_zone(host, zone));
    zoned || is_named_host(host)
}

fn is_named_host(host: &str) -> bool {
    host == plain_host(name::IMAGES)
        || call_pool()
            .iter()
            .any(|(node, _)| name::call_host(node) == host)
}

pub fn note(origin: &str, tier: Tier, ok: bool) {
    let event = Event::of(tier, ok);
    let failed = matches!(event, Event::DirectFailed);
    record(origin, failed, |inner, now| inner.apply(origin, event, now));
    if failed && has_direct(origin) {
        crate::network::dns::suspect(&plain_host(origin));
    }
}

pub fn note_delivered(origin: &str, tier: Tier, bytes: u64) {
    if tier == Tier::Direct {
        record(origin, false, |inner, now| {
            inner.apply(origin, Event::DirectDelivered(bytes), now)
        });
    }
}

pub fn note_url(url: &str, tier: Tier, ok: bool) {
    if let Some(label) = label_of(url) {
        note(label, tier, ok);
    }
}

pub fn note_url_delivered(url: &str, tier: Tier, bytes: u64) {
    if let Some(label) = label_of(url) {
        note_delivered(label, tier, bytes);
    }
}

fn settle(origin: &str, tier: Tier) {
    record(origin, true, |inner, now| inner.conclude(origin, tier, now));
}

fn record(origin: &str, failed: bool, step: impl FnOnce(&mut Inner, Instant) -> Change) {
    if !name::SERVICES.contains(&origin) {
        return;
    }
    let change = {
        let mut inner = lock();
        let change = step(&mut inner, Instant::now());
        if change != Change::None {
            persist::save(&inner);
        }
        change
    };
    let minutes = REVALIDATE.as_secs() / 60;
    match change {
        Change::Pinned => {
            diagnostics::log(
                "INFO",
                format!("[Edge] {origin} -> relay for {minutes} min"),
            );
            if failed {
                crate::network::netcheck::auto("edge-pin");
            }
        }
        Change::Escalated => {
            diagnostics::log("INFO", format!("[Edge] {origin} -> pro for {minutes} min"))
        }
        Change::Unpinned => {
            let back = if has_direct(origin) {
                "direct"
            } else {
                "relay"
            };
            diagnostics::log("INFO", format!("[Edge] {origin} -> {back}"))
        }
        Change::None => {}
    }
    if change != Change::None {
        announce_change();
    }
}

static APP: OnceLock<crate::rt::AppHandle> = OnceLock::new();

pub fn attach(app: crate::rt::AppHandle) {
    APP.set(app).ok();
}

fn announce_change() {
    if let Some(app) = APP.get() {
        announce(app);
    }
}

pub fn announce(app: &crate::rt::AppHandle) {
    config::announce(app, edge_config());
}

pub fn escalate_all() {
    for label in name::SERVICES {
        record(label, false, |inner, now| {
            inner.conclude(label, Tier::Pro, now)
        });
    }
}

pub fn escalate_relayed() {
    let relayed = lock().relayed(Instant::now());
    for label in relayed {
        record(label, false, |inner, now| {
            inner.conclude(label, Tier::Pro, now)
        });
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
        Tier::Relay | Tier::Pro => {
            status == 421 || gateway_page || (gateway && content_type.trim().is_empty())
        }
    }
}

pub fn pins() -> Vec<(String, u64)> {
    let inner = lock();
    let now = Instant::now();
    let mut pins: Vec<(String, u64)> = inner
        .origins
        .iter()
        .filter(|(_, s)| s.pinned(now))
        .map(|(label, s)| {
            let left = s.until.saturating_duration_since(now).as_millis() as u64;
            (label.clone(), left)
        })
        .collect();
    pins.sort();
    pins
}

pub fn pro_pins() -> Vec<String> {
    let inner = lock();
    let now = Instant::now();
    let mut pro: Vec<String> = inner
        .origins
        .iter()
        .filter(|(_, s)| s.level(now) == Tier::Pro)
        .map(|(label, _)| label.clone())
        .collect();
    pro.sort();
    pro
}

#[tauri::command]
pub fn edge_config() -> EdgeConfig {
    config::of(&lock(), Instant::now())
}

#[tauri::command]
pub fn edge_note(origin: String, tier: Tier, ok: bool) {
    if ok && tier != Tier::Pro {
        settle(&origin, tier);
    } else {
        note(&origin, tier, ok);
    }
}
