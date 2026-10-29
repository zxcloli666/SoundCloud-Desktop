use std::collections::VecDeque;
use std::sync::Mutex;

use backend_contracts::diag::Service;

use crate::network::edge::Tier;
use crate::network::fail::FailKind;
use crate::network::netcheck::model::Role;

pub const CAPACITY: usize = 300;

#[derive(Clone, Debug)]
pub struct Attempt {
    pub at_ms: u64,
    pub trace: String,
    pub span: String,
    pub debug: bool,
    pub service: Service,
    pub method: String,
    pub path: String,
    pub hop: String,
    pub origin: String,
    pub tier: Tier,
    pub role: Role,
    pub source: &'static str,
    pub status: u16,
    pub ms: u32,
    pub error: Option<String>,
    pub fail: Option<FailKind>,
    pub bytes: u64,
}

impl Attempt {
    pub fn ok(&self) -> bool {
        self.fail.is_none() && self.status < 500 && self.status != 421
    }
}

static RING: Mutex<VecDeque<Attempt>> = Mutex::new(VecDeque::new());

pub fn record(attempt: Attempt) {
    let mut ring = RING.lock().unwrap_or_else(|poison| poison.into_inner());
    if ring.len() >= CAPACITY {
        ring.pop_front();
    }
    ring.push_back(attempt);
}

pub fn newest_first(limit: usize) -> Vec<Attempt> {
    RING.lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect()
}

pub fn oldest_first() -> Vec<Attempt> {
    RING.lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .iter()
        .cloned()
        .collect()
}

pub fn service_of(host: &str) -> Service {
    let first = host.split('.').next().unwrap_or(host);
    if first.starts_with("api") {
        Service::Api
    } else if first.starts_with("stream") {
        Service::Stream
    } else if first.starts_with("storage") || first.starts_with("s3") {
        Service::Storage
    } else if first.starts_with("pay") {
        Service::Pay
    } else if first.starts_with("images") {
        Service::Images
    } else {
        Service::Other
    }
}

pub fn hop_label(host: &str, tier: Tier) -> String {
    match tier {
        Tier::Direct => "direct".to_string(),
        Tier::Relay => numbered(host.split('.').nth(1), 'r'),
        Tier::Pro => numbered(host.split('.').next(), 'p'),
    }
}

fn numbered(label: Option<&str>, prefix: char) -> String {
    match label {
        Some(label)
            if label.strip_prefix(prefix).is_some_and(|digits| {
                !digits.is_empty() && digits.bytes().all(|byte| byte.is_ascii_digit())
            }) =>
        {
            label.to_string()
        }
        _ => format!("{prefix}0"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(status: u16) -> Attempt {
        Attempt {
            at_ms: 0,
            trace: "t".repeat(32),
            span: "s".repeat(16),
            debug: false,
            service: Service::Api,
            method: "GET".to_string(),
            path: "/me".to_string(),
            hop: "direct".to_string(),
            origin: "attempt-ring.scnative.dev".to_string(),
            tier: Tier::Direct,
            role: Role::Primary,
            source: "api",
            status,
            ms: 5,
            error: None,
            fail: None,
            bytes: 0,
        }
    }

    #[test]
    fn the_ring_keeps_the_newest_three_hundred() {
        for status in 0..(CAPACITY as u16 + 20) {
            record(sample(status));
        }
        let all = oldest_first();
        assert_eq!(all.len(), CAPACITY);
        let mine: Vec<_> = all
            .iter()
            .filter(|attempt| attempt.origin == "attempt-ring.scnative.dev")
            .collect();
        assert!(mine.iter().all(|attempt| attempt.status >= 20));
        assert_eq!(mine.last().unwrap().status, CAPACITY as u16 + 19);
        assert_eq!(newest_first(5).len(), 5);
    }

    #[test]
    fn services_and_hops_are_named_from_hosts() {
        assert_eq!(service_of("api-star.scnative.dev"), Service::Api);
        assert_eq!(service_of("stream.r2.relay.scnative.dev"), Service::Stream);
        assert_eq!(service_of("s3.scnative.dev"), Service::Storage);
        assert_eq!(service_of("example.com"), Service::Other);
        assert_eq!(hop_label("stream.r2.relay.scnative.dev", Tier::Relay), "r2");
        assert_eq!(hop_label("p1.pro.scnative.dev", Tier::Pro), "p1");
        assert_eq!(hop_label("api.scnative.dev", Tier::Direct), "direct");
        assert_eq!(hop_label("stream.relay.scnative.dev", Tier::Relay), "r0");
        assert_eq!(hop_label("pro.scnative.dev", Tier::Pro), "p0");
    }

    #[test]
    fn ok_follows_the_net_check_rule() {
        assert!(sample(200).ok());
        assert!(!sample(502).ok());
        assert!(!sample(421).ok());
        let mut failed = sample(0);
        failed.fail = Some(FailKind::Reset);
        assert!(!failed.ok());
    }
}
