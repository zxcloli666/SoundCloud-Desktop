use std::time::{Duration, Instant};

use futures_util::stream::{self, StreamExt};
use reqwest::Client;

use super::link;
use super::model::{PROBE_PATH, Sample, Topology};
use crate::network::backend;
use crate::network::edge::{self, Tier};

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_PARALLEL: usize = 4;

pub struct Pool {
    pub relays: Vec<String>,
}

/// Каждый круг все пути щупаются пробой, которая заведомо переваливает за порог
/// счётчика: только так видно «дошло N килобайт и тишина». Глубокий замер полосы
/// дорогой, поэтому за круг его получает одна нода, по очереди.
pub async fn probe_paths(client: &Client, pool: &Pool, round: usize) -> Vec<Sample> {
    let mut targets: Vec<(String, String)> = match edge::relay_zone() {
        Some(zone) => pool
            .relays
            .iter()
            .map(|node| (node.clone(), format!("https://{node}.{zone}{PROBE_PATH}")))
            .collect(),
        None => Vec::new(),
    };
    if let Some(base) = backend::config().health_base.as_deref() {
        targets.push(("direct".to_string(), format!("{base}{PROBE_PATH}")));
    }

    let deep_at = if targets.is_empty() {
        0
    } else {
        round % targets.len()
    };

    stream::iter(targets.into_iter().enumerate())
        .map(|(at, (node, url))| {
            let client = client.clone();
            async move {
                let mut measured = link::probe(&client, &url, link::PROBE_BYTES).await;
                if at == deep_at && measured.shape == link::Shape::Clear {
                    measured = measure_bandwidth(&client, &url).await;
                }
                Sample {
                    ep: format!("@{node}"),
                    via: "direct".to_string(),
                    ok: measured.shape.usable(),
                    ms: Some(measured.ms),
                    fail: (!measured.shape.usable())
                        .then(|| measured.shape.as_str().to_string()),
                    link: Some(measured.link),
                }
            }
        })
        .buffer_unordered(MAX_PARALLEL)
        .collect()
        .await
}

/// Задушенный путь отдаёт маленький объект на полной скорости, а большой ползёт:
/// до срабатывания счётчика он просто не доходит. Узкий канал ползёт на обоих.
async fn measure_bandwidth(client: &Client, url: &str) -> link::Measured {
    let deep = link::probe(client, url, link::DEEP_BYTES).await;
    if deep.shape != link::Shape::Slow {
        return deep;
    }
    let small = link::probe(client, url, link::SMALL_BYTES).await;
    let shape = link::attribute(&deep, &small);
    link::Measured {
        shape,
        link: super::model::Link {
            shape: shape.as_str(),
            ..deep.link
        },
        ..deep
    }
}

pub async fn probe_services(client: &Client, topology: &Topology, pool: &Pool) -> Vec<Sample> {
    let batches = stream::iter(topology.endpoints.clone())
        .map(|endpoint| {
            let client = client.clone();
            let routes = endpoint.routes(&pool.relays);
            async move {
                let mut samples = Vec::with_capacity(routes.len());
                let mut direct_ok = false;
                let mut relay_ok = false;
                for route in routes {
                    let outcome = hit(&client, &route.url).await;
                    if route.via == "direct" {
                        direct_ok = outcome.ok;
                        edge::note_url(&endpoint.url, Tier::Direct, outcome.ok);
                    } else {
                        relay_ok |= outcome.ok;
                    }
                    samples.push(Sample {
                        ep: endpoint.id.clone(),
                        via: route.via,
                        ok: outcome.ok,
                        ms: outcome.ms,
                        fail: outcome.fail.map(str::to_string),
                        link: None,
                    });
                }
                if !direct_ok && relay_ok {
                    edge::note_url(&endpoint.url, Tier::Relay, true);
                }
                samples
            }
        })
        .buffer_unordered(MAX_PARALLEL)
        .collect::<Vec<_>>()
        .await;

    batches.into_iter().flatten().collect()
}

struct Outcome {
    ok: bool,
    ms: Option<i32>,
    fail: Option<&'static str>,
}

async fn hit(client: &Client, url: &str) -> Outcome {
    let started = Instant::now();
    match client.get(url).timeout(PROBE_TIMEOUT).send().await {
        Ok(response) if response.status().is_success() || response.status().is_redirection() => {
            Outcome {
                ok: true,
                ms: Some(started.elapsed().as_millis().min(i32::MAX as u128) as i32),
                fail: None,
            }
        }
        Ok(_) => Outcome {
            ok: false,
            ms: None,
            fail: Some("status"),
        },
        Err(error) if error.is_timeout() => Outcome {
            ok: false,
            ms: None,
            fail: Some("timeout"),
        },
        Err(error) if error.is_connect() => Outcome {
            ok: false,
            ms: None,
            fail: Some("reset"),
        },
        Err(_) => Outcome {
            ok: false,
            ms: None,
            fail: Some("reset"),
        },
    }
}
