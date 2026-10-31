use futures_util::StreamExt;
use wreq::Client;

use super::meter::Meter;
use super::{FASTER, PROBE_BYTES, PROBE_TIMEOUT};
use crate::network::edge;

pub async fn measure(client: &Client, pool: &[String]) -> Vec<(String, u64)> {
    let probes = pool
        .iter()
        .map(|node| async move { (node.clone(), probe(client, node).await) });
    futures_util::future::join_all(probes).await
}

async fn probe(client: &Client, node: &str) -> u64 {
    let host = edge::relay_host("storage", node);
    let url = format!("https://{host}/probe?bytes={PROBE_BYTES}");
    let deadline = tokio::time::Instant::now() + PROBE_TIMEOUT;
    let Ok(Ok(response)) = tokio::time::timeout_at(deadline, client.get(url).send()).await else {
        return 0;
    };
    if !response.status().is_success() {
        return 0;
    }
    let mut body = response.bytes_stream();
    let mut meter = Meter::default();
    loop {
        match tokio::time::timeout_at(deadline, body.next()).await {
            Ok(Some(Ok(chunk))) => meter.got(chunk.len()),
            Ok(Some(Err(_))) => return 0,
            Ok(None) | Err(_) => return meter.speed(),
        }
    }
}

pub fn slower(current: &str, speeds: &[(String, u64)]) -> Vec<String> {
    let mine = speeds
        .iter()
        .find(|(node, _)| node == current)
        .map_or(0, |(_, speed)| *speed);
    let best = speeds
        .iter()
        .filter(|(node, _)| node != current)
        .map(|(_, speed)| *speed)
        .max()
        .unwrap_or(0);
    if best == 0 || (best as f64) < mine as f64 * FASTER {
        return Vec::new();
    }
    speeds
        .iter()
        .filter(|(_, speed)| *speed as f64 * FASTER <= best as f64)
        .map(|(node, _)| node.clone())
        .collect()
}
