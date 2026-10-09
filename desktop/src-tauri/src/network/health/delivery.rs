use std::time::Duration;

use wreq::Client;
use serde::Serialize;

use super::model::{Sample, Topology};
use crate::network::edge;
use crate::network::pro::{self, Asked};

const DELIVERY_TIMEOUT: Duration = Duration::from_secs(6);
const MAX_SAMPLES: usize = 256;

#[derive(Serialize)]
struct Report<'a> {
    client: &'a str,
    version: &'a str,
    topology: u32,
    samples: &'a [Sample],
}

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
        let asked = asked(topology, "GET", "topology", None)?;
        let fresh = through_pro(asked).await?;
        serde_json::from_slice::<Topology>(&fresh)
            .ok()
            .map(Topology::sanitized)
    }

    pub async fn report(
        &self,
        topology: &Topology,
        client_id: &str,
        app_version: &str,
        samples: &[Sample],
    ) -> bool {
        if samples.is_empty() {
            return true;
        }
        let Ok(body) = serde_json::to_vec(&Report {
            client: client_id,
            version: app_version,
            topology: topology.version,
            samples: &samples[..samples.len().min(MAX_SAMPLES)],
        }) else {
            return false;
        };

        for origin in &topology.ingest {
            let url = format!("{}/report", origin.trim_end_matches('/'));
            let request = self
                .client
                .post(&url)
                .header(wreq::header::CONTENT_TYPE, "application/json")
                .body(body.clone())
                .timeout(DELIVERY_TIMEOUT);
            if request
                .send()
                .await
                .is_ok_and(|response| response.status().is_success())
            {
                return true;
            }
        }
        match asked(topology, "POST", "report", Some(body)) {
            Some(asked) => through_pro(asked).await.is_some(),
            None => false,
        }
    }
}

fn asked(topology: &Topology, method: &str, path: &str, body: Option<Vec<u8>>) -> Option<Asked> {
    let origin = topology.ingest.first()?;
    Some(Asked {
        method: method.to_string(),
        url: format!("{}/{path}", origin.trim_end_matches('/')),
        headers: vec![("content-type".to_string(), "application/json".to_string())],
        body,
    })
}

async fn through_pro(asked: Asked) -> Option<Vec<u8>> {
    for host in edge::pro_hosts() {
        if let Ok((status, body)) = pro::whole(&host, asked.clone()).await
            && (200..300).contains(&status)
        {
            return Some(body);
        }
    }
    None
}
