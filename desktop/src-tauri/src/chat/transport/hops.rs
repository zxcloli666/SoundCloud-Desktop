use sc_chat::Tier;
use sc_chat::channel::{AUTH_PATH, CHANNEL_PATH};

use crate::network::edge;

const API_ORIGIN: &str = "https://api.scnative.dev";
const STAR_ORIGIN: &str = "https://api-star.scnative.dev";
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
        Self::Edge(endpoint(API_ORIGIN, CHANNEL_PATH))
    }

    pub fn fixed(origin: &str) -> Self {
        Self::Fixed(endpoint(origin, CHANNEL_PATH))
    }

    pub fn auth_main() -> Self {
        Self::auth_at(API_ORIGIN)
    }

    pub fn auth_star() -> Self {
        Self::auth_at(STAR_ORIGIN)
    }

    fn auth_at(origin: &str) -> Self {
        match dev_origin() {
            Some(dev) => Self::Fixed(endpoint(&dev, AUTH_PATH)),
            None => Self::Edge(endpoint(origin, AUTH_PATH)),
        }
    }

    pub fn from_env() -> Self {
        match dev_origin() {
            Some(origin) => Self::fixed(&origin),
            None => Self::edge(),
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

fn dev_origin() -> Option<String> {
    match std::env::var(ORIGIN_ENV) {
        Ok(origin) if cfg!(debug_assertions) && !origin.trim().is_empty() => {
            Some(origin.trim().to_owned())
        }
        _ => None,
    }
}

fn endpoint(origin: &str, path: &str) -> String {
    format!("{}{path}", origin.trim_end_matches('/'))
}
