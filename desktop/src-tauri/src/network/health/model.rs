use serde::{Deserialize, Serialize};

use crate::network::edge;

const ORIGIN_ZONE: &str = "scnative.space";
pub const PROBE_PATH: &str = "/probe";
pub const HEALTH_PATH: &str = "/health";

const MAX_ENDPOINTS: usize = 64;
const MAX_NODES: usize = 16;
const MAX_INGEST: usize = 8;

#[derive(Clone, Debug, Deserialize)]
pub struct Topology {
    #[serde(default)]
    pub version: u32,
    #[serde(default = "default_probe_interval")]
    pub probe_interval_secs: u64,
    #[serde(default)]
    pub ingest: Vec<String>,
    #[serde(default)]
    pub relays: Vec<String>,
    #[serde(default)]
    pub calls: Vec<CallNode>,
    #[serde(default)]
    pub pros: Vec<String>,
    #[serde(default)]
    pub endpoints: Vec<Endpoint>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CallNode {
    pub id: String,
    #[serde(default = "default_weight")]
    pub weight: f64,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Endpoint {
    pub id: String,
    pub url: String,
    #[serde(default)]
    pub tiers: Vec<String>,
}

fn default_probe_interval() -> u64 {
    300
}

fn default_weight() -> f64 {
    1.0
}

#[derive(Clone, Debug, Serialize)]
pub struct Sample {
    pub ep: String,
    pub via: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ms: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<Link>,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Link {
    pub shape: &'static str,
    pub kbps: i32,
    /// Сколько байт успело дойти: «висит» и «висит на 13 КБ» это разные беды.
    pub bytes: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Route {
    pub via: String,
    pub url: String,
}

impl Endpoint {
    pub fn routes(&self, relays: &[String]) -> Vec<Route> {
        let mut routes = Vec::new();
        for tier in &self.tiers {
            match tier.as_str() {
                "direct" => routes.push(Route {
                    via: "direct".to_string(),
                    url: self.url.clone(),
                }),
                "relay" => routes.extend(relay_routes(&self.url, relays)),
                _ => {}
            }
        }
        if routes.is_empty() {
            routes.push(Route {
                via: "direct".to_string(),
                url: self.url.clone(),
            });
        }
        routes
    }
}

fn relay_routes(url: &str, relays: &[String]) -> Vec<Route> {
    let Ok(parsed) = url::Url::parse(url) else {
        return Vec::new();
    };
    let Some(label) = parsed.host_str().and_then(edge::service_label) else {
        return Vec::new();
    };
    relays
        .iter()
        .filter_map(|node| {
            let mut hop = parsed.clone();
            hop.set_scheme("https").ok()?;
            hop.set_host(Some(&format!("{label}.{node}.{}", edge::relay_zone())))
                .ok()?;
            hop.set_port(None).ok()?;
            Some(Route {
                via: format!("relay:{node}"),
                url: hop.to_string(),
            })
        })
        .collect()
}

impl Topology {
    pub fn bootstrap() -> Self {
        let endpoint = |id: &str| Endpoint {
            id: id.to_string(),
            url: format!("https://{id}.{ORIGIN_ZONE}{HEALTH_PATH}"),
            tiers: vec!["direct".to_string(), "relay".to_string()],
        };
        Self {
            version: 0,
            probe_interval_secs: default_probe_interval(),
            ingest: vec![
                format!("https://health.{ORIGIN_ZONE}"),
                format!("https://{}", edge::primary_relay_host("health")),
            ],
            relays: Vec::new(),
            calls: Vec::new(),
            pros: Vec::new(),
            endpoints: ["api", "stream", "storage", "images", "pay"]
                .into_iter()
                .map(endpoint)
                .collect(),
        }
    }

    pub fn sanitized(mut self) -> Self {
        self.probe_interval_secs = self.probe_interval_secs.clamp(30, 86_400);
        self.ingest.retain(|origin| origin.starts_with("https://"));
        self.ingest.truncate(MAX_INGEST);
        self.relays.retain(|node| is_node(node));
        self.relays.truncate(MAX_NODES);
        self.calls.retain(|node| is_node(&node.id));
        self.calls.truncate(MAX_NODES);
        self.pros.retain(|node| is_node(node));
        self.pros.truncate(MAX_NODES);
        self.endpoints
            .retain(|endpoint| !endpoint.id.is_empty() && endpoint.url.starts_with("https://"));
        self.endpoints.truncate(MAX_ENDPOINTS);
        self
    }

    pub fn call_nodes(&self) -> Vec<String> {
        self.calls.iter().map(|call| call.id.clone()).collect()
    }

    pub fn weighted_calls(&self, discovered: &[String]) -> Vec<(String, f64)> {
        discovered
            .iter()
            .map(|node| {
                let weight = self
                    .calls
                    .iter()
                    .find(|call| &call.id == node)
                    .map(|call| call.weight.clamp(0.0, 1000.0))
                    .unwrap_or(1.0);
                (node.clone(), weight)
            })
            .collect()
    }
}

pub fn is_node(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 32
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bootstrap_carries_no_node_list() {
        let topology = Topology::bootstrap();
        assert!(topology.relays.is_empty());
        assert!(topology.calls.is_empty());
        assert_eq!(topology.ingest.len(), 2);
        assert!(topology.ingest.iter().all(|origin| !origin.ends_with('/')));
    }

    #[test]
    fn a_node_the_server_publishes_becomes_a_route_of_its_own() {
        let endpoint = Endpoint {
            id: "api".into(),
            url: "https://api.scnative.space/health".into(),
            tiers: vec!["direct".into(), "relay".into()],
        };
        let routes = endpoint.routes(&["r1".to_string(), "r7".to_string()]);
        assert_eq!(
            routes.iter().map(|r| r.via.as_str()).collect::<Vec<_>>(),
            ["direct", "relay:r1", "relay:r7"]
        );
        assert_eq!(routes[2].url, "https://api.r7.relay.scnative.space/health");
    }

    #[test]
    fn an_endpoint_outside_our_zone_stays_direct_only() {
        let endpoint = Endpoint {
            id: "status".into(),
            url: "https://status.soundcloud-desktop.fun/api/health".into(),
            tiers: vec!["direct".into(), "relay".into()],
        };
        let routes = endpoint.routes(&["r1".to_string()]);
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].via, "direct");
    }

    #[test]
    fn a_tier_this_build_does_not_know_is_ignored_not_fatal() {
        let endpoint = Endpoint {
            id: "call".into(),
            url: "https://call-1.scnative.space/health".into(),
            tiers: vec!["direct".into(), "call".into()],
        };
        assert_eq!(endpoint.routes(&[]).len(), 1);
    }

    #[test]
    fn junk_from_the_wire_is_dropped_before_it_is_used() {
        let topology = Topology {
            version: 1,
            probe_interval_secs: 1,
            ingest: vec!["http://plain".into(), "https://health.x".into()],
            relays: vec!["r1".into(), "R2".into()],
            calls: vec![CallNode {
                id: "call-1".into(),
                weight: 1.0,
            }],
            pros: vec!["p1".into(), "P2".into()],
            endpoints: vec![Endpoint {
                id: String::new(),
                url: "https://x/health".into(),
                tiers: Vec::new(),
            }],
        }
        .sanitized();
        assert_eq!(topology.probe_interval_secs, 30);
        assert_eq!(topology.ingest, ["https://health.x"]);
        assert_eq!(topology.relays, ["r1"]);
        assert_eq!(topology.pros, ["p1"]);
        assert!(topology.endpoints.is_empty());
    }
}
