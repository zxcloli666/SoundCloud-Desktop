use std::collections::HashMap;
use std::net::IpAddr;
use std::time::Duration;

use tokio::time::Instant;

const CAPACITY: usize = 64;
const MIN_TTL: Duration = Duration::from_secs(60);
const MAX_TTL: Duration = Duration::from_secs(900);
const STALE_FOR: Duration = Duration::from_secs(3600);
const NEGATIVE_FOR: Duration = Duration::from_secs(15);

struct Entry {
    addrs: Vec<IpAddr>,
    fresh_until: Instant,
    stale_until: Instant,
    failed_until: Instant,
}

impl Entry {
    fn empty(now: Instant) -> Self {
        Self {
            addrs: Vec::new(),
            fresh_until: now,
            stale_until: now,
            failed_until: now,
        }
    }

    fn expires(&self) -> Instant {
        self.stale_until.max(self.failed_until)
    }
}

#[derive(Default)]
pub struct Cache {
    entries: HashMap<String, Entry>,
}

impl Cache {
    pub fn fresh(&self, host: &str, now: Instant) -> Option<Vec<IpAddr>> {
        self.entries
            .get(host)
            .filter(|entry| !entry.addrs.is_empty() && now < entry.fresh_until)
            .map(|entry| entry.addrs.clone())
    }

    pub fn stale(&self, host: &str, now: Instant) -> Option<Vec<IpAddr>> {
        self.entries
            .get(host)
            .filter(|entry| !entry.addrs.is_empty() && now < entry.stale_until)
            .map(|entry| entry.addrs.clone())
    }

    pub fn failed_recently(&self, host: &str, now: Instant) -> bool {
        self.entries
            .get(host)
            .is_some_and(|entry| now < entry.failed_until)
    }

    pub fn put(&mut self, host: &str, addrs: Vec<IpAddr>, ttl_secs: u32, now: Instant) {
        let ttl = Duration::from_secs(ttl_secs.into()).clamp(MIN_TTL, MAX_TTL);
        let entry = self.slot(host, now);
        entry.addrs = addrs;
        entry.fresh_until = now + ttl;
        entry.stale_until = now + ttl + STALE_FOR;
        entry.failed_until = now;
    }

    pub fn fail(&mut self, host: &str, now: Instant) {
        self.slot(host, now).failed_until = now + NEGATIVE_FOR;
    }

    fn slot(&mut self, host: &str, now: Instant) -> &mut Entry {
        if !self.entries.contains_key(host) && self.entries.len() >= CAPACITY {
            self.evict(now);
        }
        self.entries
            .entry(host.to_string())
            .or_insert_with(|| Entry::empty(now))
    }

    fn evict(&mut self, now: Instant) {
        self.entries.retain(|_, entry| entry.expires() > now);
        if self.entries.len() < CAPACITY {
            return;
        }
        let soonest = self
            .entries
            .iter()
            .min_by_key(|(_, entry)| entry.expires())
            .map(|(host, _)| host.clone());
        if let Some(host) = soonest {
            self.entries.remove(&host);
        }
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use std::net::IpAddr;
    use std::time::Duration;

    use tokio::time::Instant;

    use super::{CAPACITY, Cache};

    fn addrs() -> Vec<IpAddr> {
        vec!["188.165.221.195".parse().unwrap()]
    }

    #[test]
    fn a_short_ttl_still_holds_a_minute() {
        let now = Instant::now();
        let mut cache = Cache::default();
        cache.put("api.scnative.space", addrs(), 5, now);
        assert_eq!(
            cache.fresh("api.scnative.space", now + Duration::from_secs(59)),
            Some(addrs())
        );
        assert_eq!(
            cache.fresh("api.scnative.space", now + Duration::from_secs(61)),
            None
        );
    }

    #[test]
    fn a_long_ttl_is_cut_to_fifteen_minutes() {
        let now = Instant::now();
        let mut cache = Cache::default();
        cache.put("api.scnative.space", addrs(), 86_400, now);
        assert!(
            cache
                .fresh("api.scnative.space", now + Duration::from_secs(899))
                .is_some()
        );
        assert!(
            cache
                .fresh("api.scnative.space", now + Duration::from_secs(901))
                .is_none()
        );
    }

    #[test]
    fn an_expired_answer_serves_as_stale_for_an_hour() {
        let now = Instant::now();
        let mut cache = Cache::default();
        cache.put("api.scnative.space", addrs(), 60, now);
        let later = now + Duration::from_secs(60 + 3599);
        assert_eq!(cache.fresh("api.scnative.space", later), None);
        assert_eq!(cache.stale("api.scnative.space", later), Some(addrs()));
        assert_eq!(
            cache.stale("api.scnative.space", later + Duration::from_secs(2)),
            None
        );
    }

    #[test]
    fn a_failure_is_remembered_for_fifteen_seconds_and_keeps_the_stale_answer() {
        let now = Instant::now();
        let mut cache = Cache::default();
        cache.put("api.scnative.space", addrs(), 60, now);
        let later = now + Duration::from_secs(120);
        cache.fail("api.scnative.space", later);
        assert!(cache.failed_recently("api.scnative.space", later + Duration::from_secs(14)));
        assert!(!cache.failed_recently("api.scnative.space", later + Duration::from_secs(15)));
        assert_eq!(cache.stale("api.scnative.space", later), Some(addrs()));
        assert!(!cache.failed_recently("images.scnative.space", later));
    }

    #[test]
    fn a_full_cache_drops_the_entry_that_expires_first() {
        let now = Instant::now();
        let mut cache = Cache::default();
        cache.put("first.example", addrs(), 60, now);
        for index in 1..CAPACITY {
            cache.put(&format!("host{index}.example"), addrs(), 600, now);
        }
        cache.put("late.example", addrs(), 600, now);
        assert_eq!(cache.len(), CAPACITY);
        assert!(cache.stale("first.example", now).is_none());
        assert!(cache.fresh("late.example", now).is_some());
        assert!(cache.fresh("host1.example", now).is_some());
    }

    #[test]
    fn a_full_cache_first_drops_what_is_long_gone() {
        let now = Instant::now();
        let mut cache = Cache::default();
        for index in 0..CAPACITY {
            cache.put(&format!("host{index}.example"), addrs(), 60, now);
        }
        let later = now + Duration::from_secs(7200);
        cache.put("late.example", addrs(), 60, later);
        assert_eq!(cache.len(), 1);
    }
}
