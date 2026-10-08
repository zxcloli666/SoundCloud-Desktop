use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use super::model::{PathEvent, Role};
use crate::network::edge::Hop;
use crate::network::fail::FailKind;

const CAPACITY: usize = 100;

struct Ring(VecDeque<PathEvent>);

static RING: Mutex<Ring> = Mutex::new(Ring(VecDeque::new()));

impl Ring {
    fn push(&mut self, event: PathEvent) {
        if self.0.len() >= CAPACITY {
            self.0.pop_front();
        }
        self.0.push_back(event);
    }

    fn recent(&self, limit: usize) -> Vec<PathEvent> {
        self.0.iter().rev().take(limit).cloned().collect()
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

pub fn millis(elapsed: Duration) -> u32 {
    elapsed.as_millis().min(u32::MAX as u128) as u32
}

pub fn record(
    hop: &Hop,
    role: Role,
    outcome: Result<u16, FailKind>,
    elapsed: Duration,
    source: &'static str,
) {
    if hop.origin.is_empty() {
        return;
    }
    let (ok, status, fail) = match outcome {
        Ok(status) => (status < 500 && status != 421, Some(status), None),
        Err(kind) => (false, None, Some(kind)),
    };
    let event = PathEvent {
        at_ms: now_ms(),
        origin: hop.origin.clone(),
        tier: hop.tier,
        role,
        ok,
        status,
        fail,
        ms: Some(millis(elapsed)),
        source: source.to_string(),
    };
    RING.lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .push(event);
}

pub fn recent(limit: usize) -> Vec<PathEvent> {
    RING.lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .recent(limit)
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;
    use std::time::Duration;

    use super::{CAPACITY, Ring, recent, record};
    use crate::network::edge::{Hop, Tier};
    use crate::network::fail::FailKind;
    use crate::network::netcheck::model::{PathEvent, Role};

    fn hop(origin: &str, tier: Tier) -> Hop {
        Hop {
            url: format!("https://{origin}/"),
            tier,
            origin: origin.to_string(),
        }
    }

    fn mine(origin: &str) -> Vec<PathEvent> {
        recent(CAPACITY)
            .into_iter()
            .filter(|event| event.origin == origin)
            .collect()
    }

    #[test]
    fn outcomes_keep_their_role_status_and_failure() {
        let origin = "paths-roles.scnative.space";
        let ms = Duration::from_millis(12);
        record(
            &hop(origin, Tier::Direct),
            Role::Primary,
            Err(FailKind::Reset),
            ms,
            "api",
        );
        record(&hop(origin, Tier::Relay), Role::Hedge, Ok(200), ms, "audio");
        record(
            &hop(origin, Tier::Relay),
            Role::Failover,
            Ok(502),
            ms,
            "proxy",
        );
        let events = mine(origin);
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].role, Role::Failover);
        assert!(!events[0].ok);
        assert_eq!(events[0].status, Some(502));
        assert_eq!(events[1].role, Role::Hedge);
        assert!(events[1].ok);
        assert_eq!(events[1].tier, Tier::Relay);
        assert_eq!(events[2].fail, Some(FailKind::Reset));
        assert_eq!(events[2].ms, Some(12));
        assert_eq!(events[2].source, "api");
    }

    #[test]
    fn a_hop_without_an_origin_is_not_recorded() {
        record(
            &hop("", Tier::Direct),
            Role::Primary,
            Ok(200),
            Duration::ZERO,
            "proxy",
        );
        assert!(
            recent(CAPACITY)
                .iter()
                .all(|event| !event.origin.is_empty())
        );
    }

    #[test]
    fn the_ring_keeps_only_the_newest_hundred() {
        let mut ring = Ring(VecDeque::new());
        let template = PathEvent {
            at_ms: 0,
            origin: "api.scnative.space".to_string(),
            tier: Tier::Direct,
            role: Role::Primary,
            ok: true,
            status: None,
            fail: None,
            ms: None,
            source: "api".to_string(),
        };
        for status in 0..(CAPACITY as u16 + 20) {
            ring.push(PathEvent {
                status: Some(status),
                ..template.clone()
            });
        }
        let all = ring.recent(CAPACITY * 2);
        assert_eq!(all.len(), CAPACITY);
        assert_eq!(all[0].status, Some(CAPACITY as u16 + 19));
        assert_eq!(all[CAPACITY - 1].status, Some(20));
        assert_eq!(ring.recent(5).len(), 5);
    }
}
