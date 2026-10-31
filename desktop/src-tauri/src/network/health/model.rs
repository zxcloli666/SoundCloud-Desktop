use serde::{Deserialize, Serialize};

use crate::network::edge::{self, Key};

pub const PROBE_PATH: &str = "/probe";
pub const HEALTH_PATH: &str = "/health";

const MAX_ENDPOINTS: usize = 64;
const MAX_NODES: usize = 16;

#[derive(Clone, Debug, Deserialize)]
pub struct Topology {
    #[serde(default)]
    pub version: u32,
    #[serde(default = "default_probe_interval")]
    pub probe_interval_secs: u64,
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
        match edge::key_of(&self.url) {
            Key::Service(label) if !edge::has_direct(label) => relay_routes(&self.url, relays),
            Key::Service(_) => self.tiered_routes(relays),
            Key::Unknown(_) => Vec::new(),
            Key::Foreign => vec![direct_route(self.url.clone())],
        }
    }

    fn tiered_routes(&self, relays: &[String]) -> Vec<Route> {
        let direct = edge::direct_url(&self.url).map(direct_route);
        let mut routes = Vec::new();
        for tier in &self.tiers {
            match tier.as_str() {
                "direct" => routes.extend(direct.clone()),
                "relay" => routes.extend(relay_routes(&self.url, relays)),
                _ => {}
            }
        }
        if routes.is_empty() {
            routes.extend(direct);
        }
        routes
    }
}

fn direct_route(url: String) -> Route {
    Route {
        via: "direct".to_string(),
        url,
    }
}

fn relay_routes(url: &str, relays: &[String]) -> Vec<Route> {
    relays
        .iter()
        .filter_map(|node| {
            Some(Route {
                via: format!("relay:{node}"),
                url: edge::relay_url(url, node)?,
            })
        })
        .collect()
}

impl Topology {
    pub fn bootstrap() -> Self {
        let endpoint = |id: &str| Endpoint {
            id: id.to_string(),
            url: format!("https://{}{HEALTH_PATH}", edge::plain_host(id)),
            tiers: vec!["direct".to_string(), "relay".to_string()],
        };
        Self {
            version: 0,
            probe_interval_secs: default_probe_interval(),
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

    fn endpoint(id: &str, url: &str, tiers: &[&str]) -> Endpoint {
        Endpoint {
            id: id.into(),
            url: url.into(),
            tiers: tiers.iter().map(|tier| tier.to_string()).collect(),
        }
    }

    fn vias(routes: &[Route]) -> Vec<&str> {
        routes.iter().map(|route| route.via.as_str()).collect()
    }

    fn nodes() -> Vec<String> {
        vec!["r2".to_string(), "r1".to_string()]
    }

    #[test]
    fn bootstrap_carries_no_node_list() {
        let topology = Topology::bootstrap();
        assert!(topology.relays.is_empty());
        assert!(topology.calls.is_empty());
        assert!(
            topology
                .endpoints
                .iter()
                .all(|endpoint| !endpoint.routes(&nodes()).is_empty())
        );
    }

    #[test]
    fn a_relay_only_service_is_probed_over_relays_whatever_tiers_say() {
        for tiers in [
            &["relay"][..],
            &["direct", "relay"],
            &["direct"],
            &[],
            &["pro", "x"],
        ] {
            for url in [
                "https://api.scnative.dev/health",
                "https://api.scnative.space/health",
                "https://api.r1.relay.scnative.space/health",
            ] {
                let routes = endpoint("api", url, tiers).routes(&nodes());
                assert_eq!(vias(&routes), ["relay:r2", "relay:r1"], "{url} {tiers:?}");
                assert_eq!(routes[0].url, "https://api.r2.relay.scnative.dev/health");
            }
        }
    }

    #[test]
    fn images_keeps_the_tiers_the_server_publishes() {
        let both = endpoint(
            "images",
            "https://images.scnative.space/health",
            &["direct", "relay"],
        );
        let routes = both.routes(&nodes());
        assert_eq!(vias(&routes), ["direct", "relay:r2", "relay:r1"]);
        assert_eq!(routes[0].url, "https://images.scnative.dev/health");
        assert_eq!(routes[2].url, "https://images.r1.relay.scnative.dev/health");
        let untiered = endpoint("images", "https://images.scnative.dev/health", &[]);
        assert_eq!(vias(&untiered.routes(&nodes())), ["direct"]);
    }

    #[test]
    fn an_endpoint_outside_our_zone_stays_direct_only() {
        let status = endpoint(
            "status",
            "https://status.getsoundcloud.app/api/health",
            &["direct", "relay"],
        );
        let routes = status.routes(&nodes());
        assert_eq!(vias(&routes), ["direct"]);
        assert_eq!(routes[0].url, status.url);
    }

    #[test]
    fn an_endpoint_with_an_unknown_label_is_not_probed() {
        for url in [
            "https://call-1.scnative.dev/health",
            "https://nats-public.scnative.space/health",
        ] {
            assert!(
                endpoint("x", url, &["direct", "relay"])
                    .routes(&nodes())
                    .is_empty()
            );
        }
    }

    #[test]
    fn todays_topology_parses_and_drops_what_it_does_not_need() {
        let topology: Topology = serde_json::from_str(
            r#"{"version":32,"ingest":["https://health.r1.relay.scnative.space"],"relays":["r1","r2"],
            "endpoints":[{"id":"api","host":"main","url":"https://api.scnative.dev/health",
            "legacy_url":"https://api.scnative.space/health","tiers":["relay"],"group":"core"}]}"#,
        )
        .unwrap();
        assert_eq!(topology.version, 32);
        assert_eq!(topology.endpoints[0].routes(&topology.relays).len(), 2);
    }

    #[test]
    fn junk_from_the_wire_is_dropped_before_it_is_used() {
        let topology = Topology {
            version: 1,
            probe_interval_secs: 1,
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
        assert_eq!(topology.relays, ["r1"]);
        assert_eq!(topology.pros, ["p1"]);
        assert!(topology.endpoints.is_empty());
    }
}
