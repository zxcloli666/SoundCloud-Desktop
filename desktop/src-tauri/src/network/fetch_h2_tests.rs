use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use wreq::http2::Http2Options;

use super::{FetchRequest, Head, NetKind, configured, perform, ping};
use crate::network::h2_server::{Mode, h2_server};

fn h2_client() -> wreq::Client {
    let mut http2 = Http2Options::default();
    ping(&mut http2);
    configured(
        wreq::Client::builder()
            .no_proxy()
            .http2_only()
            .http2_options(http2),
    )
    .build()
    .unwrap()
}

fn get(url: &str) -> FetchRequest {
    FetchRequest {
        id: 1,
        url: url.to_string(),
        method: "GET".to_string(),
        headers: Vec::new(),
        body: None,
        timeout_ms: Some(40_000),
        route: None,
    }
}

fn post(url: &str) -> FetchRequest {
    FetchRequest {
        method: "POST".to_string(),
        body: Some("{}".to_string()),
        ..get(url)
    }
}

#[tokio::test]
async fn a_get_queued_on_a_frozen_h2_connection_is_replayed_on_a_fresh_one() {
    let (url, accepted) = h2_server(Mode::Freeze).await;
    let client = h2_client();
    let started = Instant::now();
    let ((stalled, _), (queued, body)) = tokio::join!(perform(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        perform(&client, get(&url)).await
    });
    let Head::Failed { error } = stalled else {
        panic!("the stalled body must fail, got {stalled:?}");
    };
    assert_eq!(error.kind, NetKind::Body);
    let Head::Answer {
        status, stalled, ..
    } = queued
    else {
        panic!("the queued get must be answered on a fresh connection, got {queued:?}");
    };
    assert_eq!(status, 200);
    assert!(stalled);
    assert_eq!(body, b"ok");
    assert!(
        started.elapsed() < Duration::from_secs(9),
        "{:?}",
        started.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 2);

    let fresh = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer {
        status, stalled, ..
    } = head
    else {
        panic!("the fresh connection must answer, got {head:?}");
    };
    assert_eq!(status, 200);
    assert!(!stalled);
    assert_eq!(body, b"ok");
    assert!(
        fresh.elapsed() < Duration::from_secs(2),
        "{:?}",
        fresh.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn a_post_queued_on_a_frozen_h2_connection_is_not_replayed() {
    let (url, accepted) = h2_server(Mode::Freeze).await;
    let client = h2_client();
    let ((stalled, _), (queued, _)) = tokio::join!(perform(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        perform(&client, post(&url)).await
    });
    assert!(matches!(stalled, Head::Failed { .. }), "{stalled:?}");
    let Head::Failed { error } = queued else {
        panic!("a post must not be sent twice, got {queued:?}");
    };
    assert_eq!(error.kind, NetKind::Timeout);
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_lagging_link_keeps_its_pooled_connection() {
    let lag = Duration::from_millis(3_500);
    let (url, accepted) = h2_server(Mode::Lagging(lag)).await;
    let client = h2_client();
    let (head, _) = perform(&client, get(&url)).await;
    assert!(matches!(head, Head::Answer { status: 200, .. }), "{head:?}");
    tokio::time::sleep(Duration::from_millis(4_500)).await;
    let asked = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer {
        status, stalled, ..
    } = head
    else {
        panic!("the idle pooled connection must still answer, got {head:?}");
    };
    assert_eq!(status, 200);
    assert!(!stalled);
    assert_eq!(body, b"ok");
    assert!(asked.elapsed() >= lag, "{:?}", asked.elapsed());
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_slow_answer_on_a_live_connection_is_not_cut_by_the_pings() {
    let (url, accepted) = h2_server(Mode::Slow(Duration::from_secs(7))).await;
    let client = h2_client();
    let started = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer { status, .. } = head else {
        panic!("a slow answer must arrive, got {head:?}");
    };
    assert_eq!(status, 200);
    assert_eq!(body, b"ok");
    assert!(started.elapsed() >= Duration::from_secs(7));
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}
