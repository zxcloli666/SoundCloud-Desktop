use std::time::{Duration, Instant};

use futures_util::stream::{self, StreamExt};
use wreq::Client;

use super::link::{self, Shape};
use super::model::{PROBE_PATH, Sample, Topology};
use crate::network::edge::{self, Tier};
use crate::network::system_proxy;

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_PARALLEL: usize = 4;
const ORIGIN_ZONE: &str = "scnative.space";
const DIRECT_EP: &str = "@direct";
const CUT_SHAPES: [Shape; 4] = [Shape::Cut, Shape::Blackhole, Shape::Reset, Shape::Throttled];

pub struct Pool {
    pub relays: Vec<String>,
    pub calls: Vec<String>,
}

/// Каждый круг все пути щупаются пробой, которая заведомо переваливает за порог
/// счётчика: только так видно «дошло N килобайт и тишина». Глубокий замер полосы
/// дорогой, поэтому за круг его получает одна нода, по очереди.
pub async fn probe_paths(client: &Client, pool: &Pool, round: usize) -> Vec<Sample> {
    let mut targets: Vec<(String, String)> = pool
        .relays
        .iter()
        .map(|node| {
            (
                node.clone(),
                format!("https://{node}.{}{PROBE_PATH}", edge::relay_zone()),
            )
        })
        .collect();
    targets.extend(
        pool.calls
            .iter()
            .map(|node| (node.clone(), format!("https://{node}.{ORIGIN_ZONE}{PROBE_PATH}"))),
    );
    targets.push((
        "direct".to_string(),
        format!("https://health.{ORIGIN_ZONE}{PROBE_PATH}"),
    ));

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

pub fn usable_first(relays: &[String], paths: &[Sample]) -> Vec<String> {
    let usable = |node: &String| {
        let ep = format!("@{node}");
        paths.iter().any(|sample| sample.ok && sample.ep == ep)
    };
    let mut ordered = relays.to_vec();
    ordered.sort_by_key(|node| !usable(node));
    ordered
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

pub fn note_direct_cut(paths: &[Sample]) {
    if !direct_cut_while_others_pass(paths) {
        return;
    }
    for origin in edge::routed_origins() {
        if !system_proxy::proxied(&format!("https://{origin}/")) {
            edge::note(origin, Tier::Direct, false);
        }
    }
}

fn direct_cut_while_others_pass(paths: &[Sample]) -> bool {
    let others_pass = paths
        .iter()
        .any(|sample| sample.ok && sample.ep != DIRECT_EP);
    let direct_cut = paths.iter().any(|sample| {
        sample.ep == DIRECT_EP
            && CUT_SHAPES
                .iter()
                .any(|shape| sample.fail.as_deref() == Some(shape.as_str()))
    });
    others_pass && direct_cut
}

pub fn direct_bytes(paths: &[Sample]) -> u64 {
    paths
        .iter()
        .find(|sample| sample.ok && sample.ep == DIRECT_EP)
        .and_then(|sample| sample.link)
        .map_or(0, |link| link.bytes.max(0) as u64)
}

pub async fn probe_services(
    client: &Client,
    topology: &Topology,
    pool: &Pool,
    direct_bytes: u64,
) -> Vec<Sample> {
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
                        if outcome.ok {
                            edge::note_url_delivered(&endpoint.url, Tier::Direct, direct_bytes);
                        } else {
                            edge::note_url(&endpoint.url, Tier::Direct, false);
                        }
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

#[cfg(test)]
mod tests {
    use super::{Sample, direct_bytes, direct_cut_while_others_pass, usable_first};
    use crate::network::health::model::Link;

    fn sample(node: &str, ok: bool) -> Sample {
        Sample {
            ep: format!("@{node}"),
            via: "direct".to_string(),
            ok,
            ms: None,
            fail: None,
            link: None,
        }
    }

    fn pool(nodes: &[&str]) -> Vec<String> {
        nodes.iter().map(|node| node.to_string()).collect()
    }

    #[test]
    fn a_relay_that_failed_its_probe_goes_to_the_back_of_the_pool() {
        let paths = [sample("r1", false), sample("r2", true), sample("r3", true)];
        assert_eq!(usable_first(&pool(&["r1", "r2", "r3"]), &paths), ["r2", "r3", "r1"]);
    }

    #[test]
    fn an_unprobed_pool_keeps_its_order() {
        assert_eq!(usable_first(&pool(&["r1", "r2"]), &[]), ["r1", "r2"]);
    }

    fn failed(node: &str, fail: &str) -> Sample {
        Sample {
            fail: Some(fail.to_string()),
            ..sample(node, false)
        }
    }

    #[test]
    fn a_cut_direct_path_counts_against_direct_only_while_a_relay_passes() {
        assert!(direct_cut_while_others_pass(&[
            failed("direct", "cut"),
            sample("r1", true)
        ]));
        assert!(direct_cut_while_others_pass(&[
            failed("direct", "reset"),
            sample("r2", true)
        ]));
        assert!(!direct_cut_while_others_pass(&[
            failed("direct", "cut"),
            failed("r1", "reset")
        ]));
        assert!(!direct_cut_while_others_pass(&[
            failed("direct", "dead"),
            sample("r1", true)
        ]));
        assert!(!direct_cut_while_others_pass(&[
            sample("direct", true),
            sample("r1", true)
        ]));
    }

    #[test]
    fn only_a_clean_direct_path_vouches_for_the_services() {
        let link = |shape, bytes| Link {
            shape,
            kbps: 0,
            bytes,
        };
        let mut clean = sample("direct", true);
        clean.link = Some(link("clear", 64 * 1024));
        let mut cut = sample("direct", false);
        cut.link = Some(link("cut", 13 * 1024));
        assert_eq!(direct_bytes(&[sample("r1", true), clean]), 64 * 1024);
        assert_eq!(direct_bytes(&[cut]), 0);
    }
}
