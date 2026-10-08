use std::time::{Duration, Instant};

use futures_util::stream::{self, StreamExt};
use wreq::Client;

use super::link::{self, Shape};
use super::model::{PROBE_PATH, Route, Sample, Topology};
use crate::network::edge::{self, Tier};
use crate::network::{fail, system_proxy};

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_PARALLEL: usize = 4;
const MAX_ROUTES: usize = 6;
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
            let judged = !system_proxy::proxied(&endpoint.url);
            async move {
                let outcomes = hit_all(&client, routes).await;
                if judged {
                    judge(&endpoint.url, &outcomes, direct_bytes);
                }
                outcomes
                    .into_iter()
                    .map(|(route, outcome)| Sample {
                        ep: endpoint.id.clone(),
                        via: route.via,
                        ok: outcome.ok,
                        ms: outcome.ms,
                        fail: outcome.fail.map(str::to_string),
                        link: None,
                    })
                    .collect::<Vec<_>>()
            }
        })
        .buffer_unordered(MAX_PARALLEL)
        .collect::<Vec<_>>()
        .await;

    batches.into_iter().flatten().collect()
}

async fn hit_all(client: &Client, routes: Vec<Route>) -> Vec<(Route, Outcome)> {
    stream::iter(routes)
        .map(|route| async move {
            let outcome = hit(client, &route.url).await;
            (route, outcome)
        })
        .buffer_unordered(MAX_ROUTES)
        .collect()
        .await
}

fn judge(url: &str, outcomes: &[(Route, Outcome)], direct_bytes: u64) {
    let direct = outcomes.iter().find(|(route, _)| route.via == "direct");
    if let Some((_, outcome)) = direct {
        note_direct(url, outcome.ok, direct_bytes);
    }
    let direct_ok = direct.is_some_and(|(_, outcome)| outcome.ok);
    let relay_ok = outcomes
        .iter()
        .any(|(route, outcome)| route.via != "direct" && outcome.ok);
    if !direct_ok && relay_ok {
        edge::note_url(url, Tier::Relay, true);
    }
}

fn note_direct(url: &str, ok: bool, direct_bytes: u64) {
    if ok {
        edge::note_url_delivered(url, Tier::Direct, direct_bytes);
    } else {
        edge::note_url(url, Tier::Direct, false);
    }
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
        Err(error) => Outcome {
            ok: false,
            ms: None,
            fail: Some(fail_label(&error)),
        },
    }
}

fn fail_label(error: &wreq::Error) -> &'static str {
    fail::of_wreq(error).as_str()
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    use super::{
        Outcome, Route, Sample, direct_bytes, direct_cut_while_others_pass, fail_label, hit_all,
        judge, usable_first,
    };
    use crate::network::edge::{self, Tier};
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
        assert_eq!(
            usable_first(&pool(&["r1", "r2", "r3"]), &paths),
            ["r2", "r3", "r1"]
        );
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
    fn a_throttled_direct_path_counts_against_direct() {
        assert!(direct_cut_while_others_pass(&[
            failed("direct", "throttled"),
            sample("r1", true)
        ]));
        assert!(!direct_cut_while_others_pass(&[
            failed("direct", "slow"),
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

    fn client() -> wreq::Client {
        wreq::Client::builder().no_proxy().build().unwrap()
    }

    async fn server(delay: Duration) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut stream, _)) = listener.accept().await else {
                    return;
                };
                tokio::spawn(async move {
                    let mut buf = [0u8; 1024];
                    let _ = stream.read(&mut buf).await;
                    tokio::time::sleep(delay).await;
                    let _ = stream
                        .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 0\r\n\r\n")
                        .await;
                });
            }
        });
        format!("http://{addr}/health")
    }

    fn route(via: &str, url: &str) -> Route {
        Route {
            via: via.to_string(),
            url: url.to_string(),
        }
    }

    #[tokio::test]
    async fn the_routes_of_one_endpoint_run_at_once() {
        let url = server(Duration::from_millis(400)).await;
        let started = Instant::now();
        let outcomes = hit_all(
            &client(),
            vec![route("direct", &url), route("relay:r1", &url)],
        )
        .await;
        assert!(started.elapsed() < Duration::from_millis(700));
        assert_eq!(outcomes.len(), 2);
        assert!(outcomes.iter().all(|(_, outcome)| outcome.ok));
    }

    #[tokio::test]
    async fn a_failed_route_names_its_failure_class() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let closed = listener.local_addr().unwrap();
        drop(listener);
        let refused = client()
            .get(format!("http://{closed}/"))
            .send()
            .await
            .unwrap_err();
        assert_eq!(fail_label(&refused), "refused");

        let silent = server(Duration::from_secs(5)).await;
        let timeout = client()
            .get(silent)
            .timeout(Duration::from_millis(200))
            .send()
            .await
            .unwrap_err();
        assert_eq!(fail_label(&timeout), "timeout");
    }

    fn outcome(ok: bool) -> Outcome {
        Outcome {
            ok,
            ms: None,
            fail: (!ok).then_some("reset"),
        }
    }

    #[test]
    fn one_round_with_a_cut_direct_route_does_not_pin_the_origin_alone() {
        let url = "https://stream-star.scnative.space/health";
        let round = [
            (route("direct", url), outcome(false)),
            (route("relay:r1", url), outcome(true)),
        ];
        judge(url, &round, 0);
        assert_eq!(edge::current_tier(url), Tier::Direct);
        judge(url, &round, 0);
        assert_eq!(edge::current_tier(url), Tier::Relay);
    }
}
