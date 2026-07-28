use serde::{Deserialize, Serialize};

use crate::network::edge::primary_relay_host;

/// Зона прямых origin'ов. Relay-имена живут в `network::edge`.
const ORIGIN_ZONE: &str = "scnative.space";

fn relay_host(service: &str) -> String {
    primary_relay_host(service)
}

fn report_url(service: &str) -> String {
    format!("https://{service}.{ORIGIN_ZONE}/report")
}

#[derive(Clone, Debug, Deserialize)]
pub struct Topology {
    pub meta: Meta,
    #[serde(default)]
    pub ingest: Vec<IngestSink>,
    #[serde(default)]
    pub endpoints: Vec<Endpoint>,
    #[serde(default)]
    pub workers: Workers,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Meta {
    pub version: u32,
    #[serde(default = "default_probe_interval")]
    pub probe_interval_secs: u64,
}

fn default_probe_interval() -> u64 {
    300
}

#[derive(Clone, Debug, Deserialize)]
pub struct IngestSink {
    pub tier: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
}

impl IngestSink {
    pub fn origin(&self) -> Option<String> {
        let raw = self.url.as_deref().or(self.target.as_deref())?;
        let parsed = url::Url::parse(raw).ok()?;
        let host = parsed.host_str()?;
        let mut origin = format!("{}://{host}", parsed.scheme());
        if let Some(port) = parsed.port() {
            origin.push_str(&format!(":{port}"));
        }
        Some(origin)
    }

    pub fn is_worker(&self) -> bool {
        self.tier == "worker"
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct Endpoint {
    pub id: String,
    pub host: String,
    pub direct: String,
    #[serde(default)]
    pub relay: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct Workers {
    #[serde(default)]
    pub bases: Vec<String>,
    #[serde(default)]
    pub no_worker: Vec<String>,
}

impl Workers {
    pub fn applies_to(&self, endpoint_id: &str) -> bool {
        !self.bases.is_empty() && !self.no_worker.iter().any(|id| id == endpoint_id)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Sample {
    pub endpoint: String,
    pub host: String,
    pub tier: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub err_kind: Option<String>,
}

impl Topology {
    /// Built-in route only bootstraps discovery/reporting. The live server
    /// topology replaces it before the first probe whenever any ingest path works.
    pub fn bootstrap() -> Self {
        let sink = |tier: &str, url: String| IngestSink {
            tier: tier.to_string(),
            url: Some(url),
            target: None,
        };
        // Имена собираются из одного источника (`network::edge`), поэтому
        // добавление ноды `r2` в пул не требует правок здесь.
        let direct_url = |service: &str| format!("https://{service}.{ORIGIN_ZONE}/health");
        let relay_url = |service: &str| format!("https://{}/health", relay_host(service));
        let endpoint = |id: &str, host: &str, service: &str| Endpoint {
            id: id.to_string(),
            host: host.to_string(),
            direct: direct_url(service),
            relay: Some(relay_url(service)),
        };

        Self {
            meta: Meta {
                version: 0,
                probe_interval_secs: default_probe_interval(),
            },
            ingest: vec![
                sink("direct", report_url("health")),
                sink("direct", report_url("health-star")),
                sink("relay", format!("https://{}/report", relay_host("health"))),
                sink(
                    "relay",
                    format!("https://{}/report", relay_host("health-star")),
                ),
            ],
            endpoints: vec![
                endpoint("api", "main", "api"),
                endpoint("stream", "main", "stream"),
                endpoint("storage", "main", "storage"),
                endpoint("images", "main", "images"),
                endpoint("pay", "main", "pay"),
            ],
            workers: Workers::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Topology;

    #[test]
    fn bootstrap_can_reach_both_health_nodes_through_the_relay_pool() {
        let topology = Topology::bootstrap();
        assert_eq!(topology.meta.probe_interval_secs, 300);
        assert!(topology.ingest.iter().any(|sink| {
            sink.url.as_deref() == Some("https://health.r1.relay.scnative.space/report")
        }));
        assert!(topology.ingest.iter().any(|sink| {
            sink.url.as_deref() == Some("https://health-star.r1.relay.scnative.space/report")
        }));
    }

    #[test]
    fn bootstrap_carries_no_legacy_domain() {
        let topology = Topology::bootstrap();
        for sink in &topology.ingest {
            let url = sink.url.as_deref().unwrap_or_default();
            assert!(!url.contains("scdinternal"), "legacy ingest sink {url}");
        }
        for endpoint in &topology.endpoints {
            assert!(
                !endpoint.direct.contains("scdinternal"),
                "legacy direct {}",
                endpoint.direct
            );
            let relay = endpoint.relay.as_deref().unwrap_or_default();
            assert!(!relay.contains("scdinternal"), "legacy relay {relay}");
        }
    }
}
