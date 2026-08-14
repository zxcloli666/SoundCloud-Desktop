use std::sync::OnceLock;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConfig {
    pub api_base: String,
    pub streaming_base: String,
    pub images_base: String,
    pub storage_base: String,
    pub health_base: Option<String>,
    pub relay_zone: Option<String>,
}

static CONFIG: OnceLock<BackendConfig> = OnceLock::new();

pub fn config() -> &'static BackendConfig {
    CONFIG.get_or_init(|| {
        let mut config: BackendConfig = serde_json::from_str(include_str!(
            "../../../backend.config.json"
        ))
        .expect("backend.config.json must contain a valid backend configuration");

        config.api_base = normalize_base(config.api_base, "apiBase");
        config.streaming_base = normalize_base(config.streaming_base, "streamingBase");
        config.images_base = normalize_base(config.images_base, "imagesBase");
        config.storage_base = normalize_base(config.storage_base, "storageBase");
        config.health_base = config
            .health_base
            .map(|value| normalize_base(value, "healthBase"));
        config.relay_zone = config
            .relay_zone
            .map(|value| value.trim().trim_end_matches('.').to_ascii_lowercase())
            .filter(|value| !value.is_empty());
        config
    })
}

fn normalize_base(value: String, field: &str) -> String {
    let value = value.trim().trim_end_matches('/').to_string();
    let parsed = url::Url::parse(&value)
        .unwrap_or_else(|error| panic!("backend.config.json {field} is invalid: {error}"));
    let is_local = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1"));
    assert!(
        parsed.scheme() == "https" || (cfg!(debug_assertions) && is_local),
        "backend.config.json {field} must use HTTPS (HTTP is allowed only for local debug hosts)"
    );
    assert!(parsed.host_str().is_some(), "backend.config.json {field} has no host");
    value
}

fn host_of(base: &str) -> Option<String> {
    url::Url::parse(base)
        .ok()?
        .host_str()
        .map(str::to_ascii_lowercase)
}

pub fn service_bases() -> Vec<(&'static str, &'static str)> {
    let config = config();
    vec![
        ("api", config.api_base.as_str()),
        ("stream", config.streaming_base.as_str()),
        ("images", config.images_base.as_str()),
        ("storage", config.storage_base.as_str()),
    ]
}

pub fn service_origins() -> Vec<(String, &'static str)> {
    service_bases()
        .into_iter()
        .filter_map(|(label, base)| host_of(base).map(|host| (host, label)))
        .collect()
}

pub fn service_label(origin: &str) -> Option<&'static str> {
    service_origins()
        .into_iter()
        .find(|(host, _)| host == origin)
        .map(|(_, label)| label)
}

pub fn backend_hosts() -> Vec<String> {
    let mut hosts: Vec<String> = service_origins()
        .into_iter()
        .map(|(host, _)| host)
        .collect();
    if let Some(host) = config().health_base.as_deref().and_then(host_of) {
        hosts.push(host);
    }
    hosts.sort();
    hosts.dedup();
    hosts
}

pub fn inherited_origin(origin: &str) -> Option<String> {
    let config = config();
    let storage = host_of(&config.storage_base)?;
    if origin != storage {
        return None;
    }
    host_of(&config.streaming_base)
}
