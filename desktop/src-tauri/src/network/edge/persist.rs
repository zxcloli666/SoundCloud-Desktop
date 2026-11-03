use std::collections::HashMap;
use std::path::Path;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::Tier;
use super::name::SERVICES;
use super::state::{Inner, OriginState, REVALIDATE, base_of};

const STATE_FILE: &str = "edge_state.json";

#[derive(Serialize, Deserialize, Default, Debug, PartialEq, Eq)]
pub struct Persisted {
    #[serde(default)]
    pub pins: HashMap<String, u64>,
    #[serde(default)]
    pub pro: Vec<String>,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

pub fn snapshot(inner: &Inner, now: Instant, now_ms: u64) -> Persisted {
    let pinned = || inner.origins.iter().filter(|(_, s)| s.pinned(now));
    let pins = pinned()
        .map(|(label, s)| {
            let left = s.until.saturating_duration_since(now).as_millis() as u64;
            (label.clone(), now_ms.saturating_add(left))
        })
        .collect();
    let mut pro: Vec<String> = pinned()
        .filter(|(_, s)| s.tier == Tier::Pro)
        .map(|(label, _)| label.clone())
        .collect();
    pro.sort();
    Persisted { pins, pro }
}

pub fn restore(inner: &mut Inner, persisted: Persisted, now: Instant, now_ms: u64) {
    for (label, until_ms) in persisted.pins {
        if until_ms <= now_ms || !SERVICES.contains(&label.as_str()) {
            continue;
        }
        let tier = if persisted.pro.contains(&label) {
            Tier::Pro
        } else {
            Tier::Relay
        };
        let base = base_of(&label);
        if tier <= base {
            continue;
        }
        let left = Duration::from_millis(until_ms - now_ms).min(REVALIDATE);
        inner.origins.insert(
            label,
            OriginState::pinned_until(base, tier, now + left, now),
        );
    }
}

pub fn load(dir: &Path) -> Persisted {
    std::fs::read(dir.join(STATE_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(inner: &Inner) {
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
