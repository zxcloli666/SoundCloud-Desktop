use std::collections::HashMap;
use std::time::Instant;

use serde::Serialize;
use tauri::Emitter;

use super::Tier;
use super::name::{self, SERVICES};
use super::state::{Inner, REVALIDATE};

const CONFIG_EVENT: &str = "edge:config";

#[derive(Clone, Serialize)]
pub struct EdgeConfig {
    keys: HashMap<String, String>,
    relays: HashMap<String, Vec<String>>,
    origins: HashMap<String, String>,
    direct: Vec<String>,
    zones: Vec<String>,
    pro: Vec<String>,
    hints: HashMap<String, Tier>,
    revalidate_in_ms: HashMap<String, u64>,
    revalidate_ms: u64,
}

pub fn of(inner: &Inner, now: Instant) -> EdgeConfig {
    let nodes = inner.relay_nodes();
    EdgeConfig {
        keys: SERVICES
            .into_iter()
            .flat_map(|label| name::key_hosts(label).map(move |host| (host, label.to_string())))
            .collect(),
        relays: SERVICES
            .into_iter()
            .map(|label| {
                let hosts = nodes.iter().map(|node| name::relay_host(label, node));
                (label.to_string(), hosts.collect())
            })
            .collect(),
        origins: SERVICES
            .into_iter()
            .map(|label| (label.to_string(), name::plain_host(label)))
            .collect(),
        direct: SERVICES
            .into_iter()
            .filter(|label| name::has_direct(label))
            .map(str::to_string)
            .collect(),
        zones: name::OUR_ZONES.map(str::to_string).to_vec(),
        pro: inner.gateways(),
        hints: SERVICES
            .into_iter()
            .map(|label| (label.to_string(), inner.level(label, now)))
            .collect(),
        revalidate_in_ms: inner
            .origins
            .iter()
            .filter(|(_, state)| state.pinned(now))
            .map(|(label, state)| {
                let left = state.until.saturating_duration_since(now);
                (label.clone(), left.as_millis() as u64)
            })
            .collect(),
        revalidate_ms: REVALIDATE.as_millis() as u64,
    }
}

pub fn announce(app: &crate::rt::AppHandle, config: EdgeConfig) {
    app.emit(CONFIG_EVENT, config).ok();
}
