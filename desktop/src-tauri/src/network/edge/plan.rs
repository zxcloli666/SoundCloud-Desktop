use std::time::Instant;

use super::name::{self, Key};
use super::state::Inner;
use super::{Hop, Tier, lock, through_gateway};
use crate::app::diagnostics;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Pro {
    Never,
    WhenPinned,
    Last,
}

pub fn plan(url: &str) -> Vec<Hop> {
    planned(url, Pro::Last)
}

pub fn upload_plan(url: &str) -> Vec<Hop> {
    planned(url, Pro::Never)
}

pub fn audio_plan(url: &str) -> Vec<Hop> {
    planned(url, Pro::WhenPinned)
}

pub fn expand_upstreams(upstreams: &[String]) -> Vec<Hop> {
    upstreams.iter().flat_map(|url| plan(url)).collect()
}

fn planned(url: &str, pro: Pro) -> Vec<Hop> {
    plan_in(&lock(), url, pro, Instant::now())
}

pub fn plan_in(inner: &Inner, url: &str, pro: Pro, now: Instant) -> Vec<Hop> {
    match name::key_of(url) {
        Key::Service(label) => hops_in(inner, url, label, pro, now),
        Key::Unknown(host) => {
            diagnostics::error(format!("[Edge] {host}: unknown service, no route"));
            Vec::new()
        }
        Key::Foreign => vec![Hop::unplanned(url)],
    }
}

fn hops_in(inner: &Inner, url: &str, label: &'static str, pro: Pro, now: Instant) -> Vec<Hop> {
    let mut level = inner.level(label, now);
    if pro == Pro::Never {
        level = level.min(Tier::Relay);
    }
    let pros = match pro {
        Pro::Never => Vec::new(),
        Pro::WhenPinned if level != Tier::Pro => Vec::new(),
        Pro::WhenPinned | Pro::Last => pro_hops(inner, url, label),
    };
    let relays = relay_hops(inner, url, label);

    if !name::has_direct(label) {
        return if level == Tier::Pro {
            [pros, relays].concat()
        } else {
            [relays, pros].concat()
        };
    }
    if level == Tier::Pro && !pros.is_empty() {
        return pros;
    }
    let direct = direct_hop(url, label);
    if level == Tier::Direct {
        [direct, relays].concat()
    } else {
        [relays, direct].concat()
    }
}

fn relay_hops(inner: &Inner, url: &str, label: &str) -> Vec<Hop> {
    inner
        .relay_nodes()
        .iter()
        .filter_map(|node| name::on_host(url, &name::relay_host(label, node)))
        .map(|url| Hop {
            url,
            tier: Tier::Relay,
            origin: label.to_string(),
        })
        .collect()
}

fn pro_hops(inner: &Inner, url: &str, label: &str) -> Vec<Hop> {
    let Some(carried) = name::on_host(url, &name::plain_host(label)) else {
        return Vec::new();
    };
    inner
        .gateways()
        .iter()
        .map(|gateway| Hop {
            url: through_gateway(gateway, &carried),
            tier: Tier::Pro,
            origin: label.to_string(),
        })
        .collect()
}

fn direct_hop(url: &str, label: &str) -> Vec<Hop> {
    name::on_host(url, &name::plain_host(label))
        .map(|url| Hop {
            url,
            tier: Tier::Direct,
            origin: label.to_string(),
        })
        .into_iter()
        .collect()
}
