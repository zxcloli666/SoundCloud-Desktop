use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use super::Tier;
use super::name::{self, SERVICES};

pub const REVALIDATE: Duration = Duration::from_secs(600);
pub const PROVEN_BYTES: u64 = 64 * 1024;
pub const BOOTSTRAP_NODE: &str = "r1";

const BOOTSTRAP_PRO_NODE: &str = "p1";
const DIRECT_FAIL_THRESHOLD: u8 = 2;
const RELAY_WIN_THRESHOLD: u8 = 2;
const RELAY_FAIL_THRESHOLD: u8 = 3;
const RELAY_DEAD_AFTER: Duration = Duration::from_secs(5);
const PRO_FAIL_THRESHOLD: u8 = 3;

pub const INHERIT: &[(&str, &str)] = &[("storage", "stream"), ("storage-star", "stream-star")];

pub fn base_of(label: &str) -> Tier {
    if name::has_direct(label) {
        Tier::Direct
    } else {
        Tier::Relay
    }
}

pub struct OriginState {
    pub tier: Tier,
    pub base: Tier,
    pub until: Instant,
    pub direct_fails: u8,
    relay_wins: u8,
    relay_fails: u8,
    relay_failing_since: Option<Instant>,
    pro_fails: u8,
    last_at: Instant,
}

impl OriginState {
    fn new(base: Tier, now: Instant) -> Self {
        Self {
            tier: base,
            base,
            until: now,
            direct_fails: 0,
            relay_wins: 0,
            relay_fails: 0,
            relay_failing_since: None,
            pro_fails: 0,
            last_at: now,
        }
    }

    pub fn pinned_until(base: Tier, tier: Tier, until: Instant, now: Instant) -> Self {
        Self {
            tier,
            until,
            ..Self::new(base, now)
        }
    }

    pub fn level(&self, now: Instant) -> Tier {
        if now < self.until {
            self.tier
        } else {
            self.base
        }
    }

    pub fn pinned(&self, now: Instant) -> bool {
        self.level(now) != self.base
    }

    fn refresh(&mut self, now: Instant) {
        if self.tier != self.base && now >= self.until {
            self.tier = self.base;
            self.clear();
        } else if now.saturating_duration_since(self.last_at) >= REVALIDATE {
            self.clear();
        }
        self.last_at = now;
    }

    fn clear(&mut self) {
        self.direct_fails = 0;
        self.relay_wins = 0;
        self.relay_fails = 0;
        self.relay_failing_since = None;
        self.pro_fails = 0;
    }

    fn pin(&mut self, now: Instant) -> Change {
        self.tier = Tier::Relay;
        self.until = now + REVALIDATE;
        self.clear();
        Change::Pinned
    }

    fn escalate(&mut self, now: Instant) -> Change {
        self.tier = Tier::Pro;
        self.until = now + REVALIDATE;
        self.clear();
        Change::Escalated
    }

    fn unpin(&mut self) -> Change {
        self.tier = self.base;
        self.clear();
        Change::Unpinned
    }

    fn relay_failed(&mut self, now: Instant) {
        self.relay_fails = self.relay_fails.saturating_add(1);
        self.relay_failing_since.get_or_insert(now);
    }

    fn relay_is_dead(&self, now: Instant) -> bool {
        let lasting = self
            .relay_failing_since
            .is_some_and(|since| now.saturating_duration_since(since) >= RELAY_DEAD_AFTER);
        self.relay_fails >= RELAY_FAIL_THRESHOLD && lasting
    }

    fn due(&self) -> bool {
        self.direct_fails >= DIRECT_FAIL_THRESHOLD || self.relay_wins >= RELAY_WIN_THRESHOLD
    }
}

#[derive(Clone, Copy, Debug)]
pub enum Event {
    DirectFailed,
    DirectAnswered,
    DirectDelivered(u64),
    RelayWon,
    RelayFailed,
    ProWon,
    ProFailed,
}

impl Event {
    pub fn of(tier: Tier, ok: bool) -> Self {
        match (tier, ok) {
            (Tier::Direct, false) => Self::DirectFailed,
            (Tier::Direct, true) => Self::DirectAnswered,
            (Tier::Relay, true) => Self::RelayWon,
            (Tier::Relay, false) => Self::RelayFailed,
            (Tier::Pro, true) => Self::ProWon,
            (Tier::Pro, false) => Self::ProFailed,
        }
    }

    fn counts(self, base: Tier) -> bool {
        match base {
            Tier::Direct => matches!(self, Self::DirectFailed | Self::RelayWon),
            Tier::Relay | Tier::Pro => matches!(self, Self::RelayFailed),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Change {
    None,
    Pinned,
    Escalated,
    Unpinned,
}

#[derive(Default)]
pub struct Pool {
    pub relays: Vec<String>,
    pub calls: Vec<(String, f64)>,
    pub pros: Vec<String>,
}

#[derive(Default)]
pub struct Inner {
    pub origins: HashMap<String, OriginState>,
    pub pool: Pool,
    pub slow_relays: HashMap<String, Instant>,
    pub dir: Option<PathBuf>,
    pub gateway_port: Option<u16>,
}

impl Inner {
    pub fn apply(&mut self, origin: &str, event: Event, now: Instant) -> Change {
        let base = base_of(origin);
        if !event.counts(base) && !self.origins.contains_key(origin) {
            return Change::None;
        }
        let state = self
            .origins
            .entry(origin.to_string())
            .or_insert_with(|| OriginState::new(base, now));
        state.refresh(now);
        match event {
            Event::DirectFailed => state.direct_fails = state.direct_fails.saturating_add(1),
            Event::DirectAnswered => state.relay_wins = 0,
            Event::DirectDelivered(bytes) => {
                state.clear();
                if bytes >= PROVEN_BYTES && state.tier != state.base {
                    return state.unpin();
                }
            }
            Event::RelayWon => {
                state.relay_wins = state.relay_wins.saturating_add(1);
                state.relay_fails = 0;
                state.relay_failing_since = None;
            }
            Event::RelayFailed => {
                state.relay_failed(now);
                if state.tier == Tier::Relay && state.relay_is_dead(now) {
                    return state.escalate(now);
                }
            }
            Event::ProWon => state.pro_fails = 0,
            Event::ProFailed => {
                state.pro_fails = state.pro_fails.saturating_add(1);
                if state.tier == Tier::Pro && state.pro_fails >= PRO_FAIL_THRESHOLD {
                    return state.unpin();
                }
            }
        }
        if state.tier == Tier::Direct && state.due() {
            return state.pin(now);
        }
        Change::None
    }

    pub fn conclude(&mut self, origin: &str, tier: Tier, now: Instant) -> Change {
        let base = base_of(origin);
        let tier = tier.max(base);
        if tier == base && !self.origins.contains_key(origin) {
            return Change::None;
        }
        let state = self
            .origins
            .entry(origin.to_string())
            .or_insert_with(|| OriginState::new(base, now));
        state.refresh(now);
        match (tier, state.tier) {
            (Tier::Relay, Tier::Direct) => state.pin(now),
            (Tier::Direct, Tier::Relay) => state.unpin(),
            (Tier::Pro, Tier::Direct | Tier::Relay) => state.escalate(now),
            _ => Change::None,
        }
    }

    #[cfg(test)]
    pub fn pinned(&self, origin: &str, now: Instant) -> bool {
        self.level(origin, now) != base_of(origin)
    }

    pub fn level(&self, origin: &str, now: Instant) -> Tier {
        self.resolved(origin)
            .map_or(base_of(origin), |state| state.level(now))
    }

    fn resolved(&self, origin: &str) -> Option<&OriginState> {
        if let Some(state) = self.origins.get(origin) {
            return Some(state);
        }
        let (_, source) = INHERIT.iter().find(|(inherits, _)| *inherits == origin)?;
        self.origins.get(*source)
    }

    pub fn relayed(&self, now: Instant) -> Vec<&'static str> {
        SERVICES
            .into_iter()
            .filter(|label| self.level(label, now) == Tier::Relay)
            .collect()
    }

    pub fn relay_nodes(&self, now: Instant) -> Vec<String> {
        if self.pool.relays.is_empty() {
            return vec![BOOTSTRAP_NODE.to_string()];
        }
        let mut nodes = self.pool.relays.clone();
        nodes.sort_by_key(|node| self.slow_relays.get(node).is_some_and(|until| now < *until));
        nodes
    }

    pub fn demote_relays(&mut self, nodes: &[String], until: Instant) {
        self.slow_relays = nodes.iter().map(|node| (node.clone(), until)).collect();
    }

    pub fn pro_hosts(&self) -> Vec<String> {
        if self.pool.pros.is_empty() {
            return vec![name::pro_host(BOOTSTRAP_PRO_NODE)];
        }
        self.pool
            .pros
            .iter()
            .map(|node| name::pro_host(node))
            .collect()
    }

    pub fn gateways(&self) -> Vec<String> {
        let Some(port) = self.gateway_port else {
            return vec![];
        };
        self.pro_hosts()
            .iter()
            .map(|host| format!("http://127.0.0.1:{port}/pro/{host}/"))
            .collect()
    }
}
