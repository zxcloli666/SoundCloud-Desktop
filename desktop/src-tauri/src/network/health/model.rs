use serde::{Deserialize, Serialize};

use crate::network::{backend, edge};

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
    pub endpoints: Vec<Endpoint>,
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
            let zone = edge::relay_zone()?;
            hop.set_host(Some(&format!("{label}.{node}.{zone}")))
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
        let mut ingest = Vec::new();
        if let Some(base) = backend::config().health_base.as_deref() {
            ingest.push(base.to_string());
        }
        if let Some(host) = edge::primary_relay_host("health") {
            ingest.push(format!("https://{host}"));
        }
        Self {
            version: 0,
            probe_interval_secs: default_probe_interval(),
            ingest,
            relays: Vec::new(),
            endpoints: backend::service_bases()
                .into_iter()
                .map(|(id, base)| Endpoint {
                    id: id.to_string(),
                    url: format!("{base}{HEALTH_PATH}"),
                    tiers: vec!["direct".to_string(), "relay".to_string()],
                })
                .collect(),
        }
    }

    pub fn sanitized(mut self) -> Self {
        self.probe_interval_secs = self.probe_interval_secs.clamp(30, 86_400);
        self.ingest.retain(|origin| trusted_ingest(origin));
        self.ingest.truncate(MAX_INGEST);
        if edge::relay_zone().is_some() {
            self.relays.retain(|node| is_node(node));
        } else {
            self.relays.clear();
        }
        self.relays.truncate(MAX_NODES);
        self.endpoints
            .retain(configured_endpoint);
        self.endpoints.truncate(MAX_ENDPOINTS);
        self
    }
}

fn trusted_ingest(origin: &str) -> bool {
    let Ok(url) = url::Url::parse(origin) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let health_host = backend::config()
        .health_base
        .as_deref()
        .and_then(|base| url::Url::parse(base).ok())
        .and_then(|base| base.host_str().map(str::to_string));
    if health_host.as_deref() == Some(host) {
        return true;
    }
    edge::relay_zone().is_some_and(|zone| host.ends_with(&format!(".{zone}")))
}

fn configured_endpoint(endpoint: &Endpoint) -> bool {
    let Ok(url) = url::Url::parse(&endpoint.url) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    backend::service_bases().into_iter().any(|(id, base)| {
        if endpoint.id != id {
            return false;
        }
        url::Url::parse(base)
            .ok()
            .and_then(|base| base.host_str().map(|base_host| base_host == host))
            .unwrap_or(false)
    })
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
        assert_eq!(topology.endpoints.len(), 4);
        assert!(topology.ingest.iter().all(|origin| !origin.ends_with('/')));
    }

    #[test]
    fn a_node_the_server_publishes_becomes_a_route_of_its_own() {
        let api = &backend::config().api_base;
        let Some(zone) = edge::relay_zone() else {
            return;
        };
        let endpoint = Endpoint {
            id: "api".into(),
            url: format!("{api}/health"),
            tiers: vec!["direct".into(), "relay".into()],
        };
        let routes = endpoint.routes(&["r1".to_string(), "r7".to_string()]);
        assert_eq!(
            routes.iter().map(|r| r.via.as_str()).collect::<Vec<_>>(),
            ["direct", "relay:r1", "relay:r7"]
        );
        let api_url = url::Url::parse(api).unwrap();
        let label = backend::service_label(api_url.host_str().unwrap()).unwrap();
        assert_eq!(routes[2].url, format!("https://{label}.r7.{zone}/health"));
    }

    #[test]
    fn an_endpoint_outside_our_zone_stays_direct_only() {
        let endpoint = Endpoint {
            id: "status".into(),
            url: "https://status.example.com/api/health".into(),
            tiers: vec!["direct".into(), "relay".into()],
        };
        let routes = endpoint.routes(&["r1".to_string()]);
        assert_eq!(routes.len(), 1);
        assert_eq!(routes[0].via, "direct");
    }

    #[test]
    fn an_unknown_future_tier_is_ignored_not_fatal() {
        let endpoint = Endpoint {
            id: "api".into(),
            url: format!("{}/health", backend::config().api_base),
            tiers: vec!["direct".into(), "future".into()],
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
            endpoints: vec![Endpoint {
                id: String::new(),
                url: "https://x/health".into(),
                tiers: Vec::new(),
            }],
        }
        .sanitized();
        assert_eq!(topology.probe_interval_secs, 30);
        assert!(topology.ingest.is_empty());
        if edge::relay_zone().is_some() {
            assert_eq!(topology.relays, ["r1"]);
        } else {
            assert!(topology.relays.is_empty());
        }
        assert!(topology.endpoints.is_empty());
    }

    #[test]
    fn remote_topology_cannot_add_foreign_endpoints() {
        let topology = Topology {
            version: 1,
            probe_interval_secs: 300,
            ingest: Vec::new(),
            relays: Vec::new(),
            endpoints: vec![Endpoint {
                id: "api".into(),
                url: "https://evil.example/health".into(),
                tiers: vec!["direct".into()],
            }],
        }
        .sanitized();
        assert!(topology.endpoints.is_empty());
    }
}
