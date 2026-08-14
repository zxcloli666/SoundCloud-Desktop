use std::time::Duration;

use reqwest::Client;

use super::model::Topology;

const DELIVERY_TIMEOUT: Duration = Duration::from_secs(6);

pub struct Delivery {
    client: Client,
}

impl Delivery {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    pub async fn fetch_topology(&self, topology: &Topology) -> Option<Topology> {
        for origin in &topology.ingest {
            let url = format!("{}/topology", origin.trim_end_matches('/'));
            let Ok(response) = self.client.get(&url).timeout(DELIVERY_TIMEOUT).send().await else {
                continue;
            };
            if !response.status().is_success() {
                continue;
            }
            if let Ok(fresh) = response.json::<Topology>().await {
                return Some(fresh.sanitized());
            }
        }
        None
    }
}
