use sc_chat::ChatError;

use super::errors::Snag;
use crate::network::edge::{Hop, Tier};

const RELAY_MISSES: usize = 2;

#[derive(Default)]
pub struct Round {
    pub refusing: Vec<Hop>,
    tried: Vec<(Tier, String)>,
    relay_misses: usize,
}

impl Round {
    pub fn tried_on(&mut self, hop: &Hop) {
        self.tried.push(site(hop));
    }

    pub fn next(&self, hops: &[Hop]) -> Option<Hop> {
        let mut untried = hops.iter().filter(|hop| !self.tried.contains(&site(hop)));
        if self.relay_misses < RELAY_MISSES {
            return untried.next().cloned();
        }
        let untried: Vec<&Hop> = untried.collect();
        let pro = untried.iter().find(|hop| hop.tier == Tier::Pro);
        pro.or(untried.first()).map(|hop| (*hop).clone())
    }

    pub fn missed(&mut self, hop: &Hop) {
        hop.note(false);
        if hop.tier == Tier::Relay {
            self.relay_misses += 1;
        }
    }

    pub fn sink_refusing(&self) {
        for hop in &self.refusing {
            hop.note(false);
        }
    }

    pub fn ended(self) -> Result<(), Snag> {
        if !self.refusing.is_empty() && self.refusing.len() == self.tried.len() {
            return Err(Snag::Expired);
        }
        self.sink_refusing();
        Err(Snag::Failed(ChatError::Offline))
    }
}

fn site(hop: &Hop) -> (Tier, String) {
    let rest = hop
        .url
        .split_once("://")
        .map_or(hop.url.as_str(), |(_, rest)| rest);
    let host = rest.split(['/', '?']).next().unwrap_or(rest);
    (hop.tier, host.to_ascii_lowercase())
}
