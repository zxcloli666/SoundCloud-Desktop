use std::collections::HashMap;
use std::time::{Duration, Instant};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpListener;

use super::probe::{measure, slower};
use super::{CHECK_GAP, EVEN_GAP, PROBE_BYTES, SLOW_SPEED, Speed};
use crate::network::h2_server::acceptor;

const SLOW: u64 = 512 * 1024;
const CHUNK: usize = 16 * 1024;

fn pool(nodes: &[&str]) -> Vec<String> {
    nodes.iter().map(|node| node.to_string()).collect()
}

async fn head<S: AsyncRead + Unpin>(stream: &mut S) -> String {
    let mut seen = Vec::new();
    let mut byte = [0u8; 1];
    while !seen.ends_with(b"\r\n\r\n") && stream.read(&mut byte).await.is_ok_and(|read| read > 0) {
        seen.push(byte[0]);
    }
    String::from_utf8_lossy(&seen).to_string()
}

fn node_in(connect: &str) -> String {
    connect
        .strip_prefix("CONNECT storage.")
        .and_then(|rest| rest.split_once(".relay.scnative.dev:443 "))
        .map(|(node, _)| node.to_string())
        .unwrap_or_default()
}

async fn throttled<S: AsyncWrite + Unpin>(stream: &mut S, speed: u64) -> std::io::Result<()> {
    let head = format!("HTTP/1.1 200 OK\r\ncontent-length: {PROBE_BYTES}\r\n\r\n");
    stream.write_all(head.as_bytes()).await?;
    let started = tokio::time::Instant::now();
    let mut sent = 0;
    while sent < PROBE_BYTES {
        stream.write_all(&[0u8; CHUNK]).await?;
        stream.flush().await?;
        sent += CHUNK as u64;
        let due = Duration::from_secs_f64(sent as f64 / speed as f64);
        tokio::time::sleep_until(started + due).await;
    }
    Ok(())
}

async fn relays(speeds: &[(&str, u64)]) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let speeds: HashMap<String, u64> = speeds
        .iter()
        .map(|(node, speed)| (node.to_string(), *speed))
        .collect();
    let acceptor = acceptor(&[b"http/1.1"]);
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            let acceptor = acceptor.clone();
            let speeds = speeds.clone();
            tokio::spawn(async move {
                let Some(speed) = speeds.get(&node_in(&head(&mut socket).await)).copied() else {
                    return;
                };
                let established = b"HTTP/1.1 200 Connection established\r\n\r\n";
                socket.write_all(established).await.unwrap();
                let mut stream = acceptor.accept(socket).await.unwrap();
                let request = head(&mut stream).await;
                assert!(request.starts_with("GET /probe?bytes=524288 "), "{request}");
                throttled(&mut stream, speed).await.ok();
            });
        }
    });
    format!("http://{addr}")
}

fn client(proxy: &str) -> wreq::Client {
    wreq::Client::builder()
        .proxy(wreq::Proxy::all(proxy).unwrap())
        .tls_cert_verification(false)
        .pool_max_idle_per_host(0)
        .build()
        .unwrap()
}

async fn slower_after_probing(current: &str, speeds: &[(&str, u64)]) -> Vec<String> {
    let proxy = relays(speeds).await;
    let nodes: Vec<&str> = speeds.iter().map(|(node, _)| *node).collect();
    let measured = measure(&client(&proxy), &pool(&nodes)).await;
    slower(current, &measured)
}

#[test]
fn two_slow_samples_in_a_row_on_the_first_relay_start_a_check() {
    let mut speed = Speed::default();
    let slow = SLOW_SPEED - 1;
    assert!(!speed.sampled("r1", slow));
    assert!(!speed.sampled("r1", SLOW_SPEED));
    assert!(!speed.sampled("r1", slow));
    assert!(speed.sampled("r1", slow));
    assert!(speed.check_due("r1", &pool(&["r1", "r2"]), Instant::now()));
}

#[test]
fn only_the_first_relay_of_two_or_more_is_checked() {
    let mut speed = Speed::default();
    let now = Instant::now();
    assert!(!speed.check_due("r2", &pool(&["r1", "r2"]), now));
    assert!(!speed.check_due("r1", &pool(&["r1"]), now));
    assert!(speed.check_due("r1", &pool(&["r1", "r2"]), now));
}

#[test]
fn a_second_slow_event_within_2_min_starts_no_check() {
    let mut speed = Speed::default();
    let relays = pool(&["r1", "r2"]);
    let now = Instant::now();
    assert!(speed.check_due("r1", &relays, now));
    assert!(!speed.check_due("r1", &relays, now + CHECK_GAP - Duration::from_secs(1)));
    assert!(speed.check_due("r1", &relays, now + CHECK_GAP));
}

#[tokio::test]
async fn a_neighbour_1_5x_faster_sends_the_slow_relay_back() {
    let back = slower_after_probing("r1", &[("r1", SLOW), ("r2", 4 * SLOW)]).await;
    assert_eq!(back, ["r1"]);
}

#[tokio::test]
async fn every_relay_the_fastest_beats_by_1_5x_goes_back() {
    let speeds = [("r1", SLOW), ("r2", 4 * SLOW), ("r3", SLOW)];
    let back = slower_after_probing("r1", &speeds).await;
    assert_eq!(back, ["r1", "r3"]);
}

#[tokio::test]
async fn a_neighbour_only_slightly_faster_changes_nothing_and_quiets_checks_for_10_min() {
    let back = slower_after_probing("r1", &[("r1", SLOW), ("r2", 6 * SLOW / 5)]).await;
    assert!(back.is_empty(), "{back:?}");

    let mut speed = Speed::default();
    let relays = pool(&["r1", "r2"]);
    let now = Instant::now();
    assert!(speed.check_due("r1", &relays, now));
    speed.even(now);
    assert!(!speed.check_due("r1", &relays, now + EVEN_GAP - Duration::from_secs(1)));
    assert!(speed.check_due("r1", &relays, now + EVEN_GAP));
}

#[tokio::test]
async fn a_relay_that_does_not_carry_the_probe_counts_as_zero() {
    let proxy = relays(&[("r2", SLOW)]).await;
    let measured = measure(&client(&proxy), &pool(&["r1", "r2"])).await;
    assert_eq!(measured[0], ("r1".to_string(), 0));
    assert_eq!(slower("r1", &measured), ["r1"]);
}

#[test]
fn nothing_moves_when_no_relay_carried_anything() {
    let measured = [("r1".to_string(), 0), ("r2".to_string(), 0)];
    assert!(slower("r1", &measured).is_empty());
}
