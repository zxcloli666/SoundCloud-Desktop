use sc_chat::Tier;
use sc_chat::channel::CHANNEL_PATH;

use crate::network::edge;

const API_ORIGIN: &str = "https://api.scnative.dev";
const ORIGIN_ENV: &str = "SC_CHAT_ORIGIN";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hop(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Route {
    Edge(String),
    Fixed(String),
}

impl Route {
    pub fn edge() -> Self {
        Self::Edge(channel_url(API_ORIGIN))
    }

    pub fn fixed(origin: &str) -> Self {
        Self::Fixed(channel_url(origin))
    }

    pub fn from_env() -> Self {
        match std::env::var(ORIGIN_ENV) {
            Ok(origin) if cfg!(debug_assertions) && !origin.trim().is_empty() => {
                Self::fixed(origin.trim())
            }
            _ => Self::edge(),
        }
    }

    pub fn tiers(&self) -> Vec<Tier> {
        match self {
            Self::Fixed(_) => vec![Tier::Direct],
            Self::Edge(url) => {
                let mut tiers = Vec::new();
                for hop in edge::plan(url) {
                    let tier = chat_tier(hop.tier);
                    if !tiers.contains(&tier) {
                        tiers.push(tier);
                    }
                }
                tiers
            }
        }
    }

    pub fn hops(&self, tier: Tier) -> Vec<Hop> {
        match self {
            Self::Fixed(url) if tier == Tier::Direct => vec![Hop(url.clone())],
            Self::Fixed(_) => Vec::new(),
            Self::Edge(url) => edge::plan(url)
                .into_iter()
                .filter(|hop| chat_tier(hop.tier) == tier)
                .map(|hop| Hop(hop.url))
                .collect(),
        }
    }
}

fn chat_tier(tier: edge::Tier) -> Tier {
    match tier {
        edge::Tier::Direct => Tier::Direct,
        edge::Tier::Relay => Tier::Relay,
        edge::Tier::Pro => Tier::Pro,
    }
}

fn channel_url(origin: &str) -> String {
    format!("{}{CHANNEL_PATH}", origin.trim_end_matches('/'))
}
