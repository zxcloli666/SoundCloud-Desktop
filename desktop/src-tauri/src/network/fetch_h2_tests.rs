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

#[tokio::test]
async fn a_frozen_h2_connection_is_dropped_and_later_requests_get_a_fresh_one() {
    let (url, accepted) = h2_server(Mode::Freeze).await;
    let client = h2_client();
    let started = Instant::now();
    let ((stalled, _), (queued, _)) = tokio::join!(perform(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        perform(&client, get(&url)).await
    });
    let Head::Failed { error } = stalled else {
        panic!("the stalled body must fail, got {stalled:?}");
    };
    assert_eq!(error.kind, NetKind::Body);
    let Head::Failed { error } = queued else {
        panic!("the queued request must fail, got {queued:?}");
    };
    assert_eq!(error.kind, NetKind::Timeout);
    assert!(
        started.elapsed() < Duration::from_secs(6),
        "{:?}",
        started.elapsed()
    );

    let fresh = Instant::now();
    let (head, body) = perform(&client, get(&url)).await;
    let Head::Answer { status, .. } = head else {
        panic!("a fresh connection must answer, got {head:?}");
    };
    assert_eq!(status, 200);
    assert_eq!(body, b"ok");
    assert!(
        fresh.elapsed() < Duration::from_secs(2),
        "{:?}",
        fresh.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 2);
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
