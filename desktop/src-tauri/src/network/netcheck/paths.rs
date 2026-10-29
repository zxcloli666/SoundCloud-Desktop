use std::time::{Duration, SystemTime, UNIX_EPOCH};

use super::model::PathEvent;
use crate::diag::attempt::{self, Attempt, CAPACITY};

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_millis() as u64)
}

pub fn millis(elapsed: Duration) -> u32 {
    elapsed.as_millis().min(u32::MAX as u128) as u32
}

pub fn recent(limit: usize) -> Vec<PathEvent> {
    attempt::newest_first(CAPACITY)
        .into_iter()
        .filter(|attempt| !attempt.origin.is_empty())
        .take(limit)
        .map(event)
        .collect()
}

fn event(attempt: Attempt) -> PathEvent {
    PathEvent {
        at_ms: attempt.at_ms,
        ok: attempt.ok(),
        origin: attempt.origin,
        tier: attempt.tier,
        role: attempt.role,
        status: (attempt.status != 0).then_some(attempt.status),
        fail: attempt.fail,
        ms: Some(attempt.ms),
        source: attempt.source.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::recent;
    use crate::diag::attempt::{Attempt, record};
    use crate::network::edge::Tier;
    use crate::network::fail::FailKind;
    use crate::network::netcheck::model::Role;

    fn attempt(origin: &str, status: u16, fail: Option<FailKind>) -> Attempt {
        Attempt {
            at_ms: 1,
            trace: "t".repeat(32),
            span: "s".repeat(16),
            debug: false,
            service: "api",
            method: "GET".to_string(),
            path: "/".to_string(),
            hop: "direct".to_string(),
            origin: origin.to_string(),
            tier: Tier::Relay,
            role: Role::Hedge,
            source: "audio",
            status,
            ms: 12,
            error: None,
            fail,
            bytes: 0,
        }
    }

    #[test]
    fn the_net_check_reads_the_attempt_ring() {
        let origin = "paths-view.scnative.dev";
        record(attempt(origin, 0, Some(FailKind::Reset)));
        record(attempt(origin, 502, None));
        record(attempt("", 200, None));
        let mine: Vec<_> = recent(300)
            .into_iter()
            .filter(|event| event.origin == origin)
            .collect();
        assert_eq!(mine.len(), 2);
        assert_eq!(mine[0].status, Some(502));
        assert!(!mine[0].ok);
        assert_eq!(mine[1].fail, Some(FailKind::Reset));
        assert_eq!(mine[1].status, None);
        assert_eq!(mine[1].ms, Some(12));
        assert_eq!(mine[1].role, Role::Hedge);
        assert!(recent(300).iter().all(|event| !event.origin.is_empty()));
    }
}
