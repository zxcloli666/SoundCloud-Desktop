use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use wreq::http2::Http2Options;

use super::{FetchRequest, Head, NetKind, Route, configured, perform, ping};
use crate::network::edge::Tier;
use crate::network::h2_server::{Mode, h2_server, h2_server_then};
use crate::network::pace::Pace;

fn paced(pace: Pace, idle: usize) -> wreq::Client {
    let mut http2 = Http2Options::default();
    ping(&mut http2, pace);
    configured(
        wreq::Client::builder()
            .no_proxy()
            .http2_only()
            .http2_options(http2),
    )
    .pool_max_idle_per_host(idle)
    .build()
    .unwrap()
}

fn h2_client() -> wreq::Client {
    paced(Pace::Quick, 8)
}

fn one_shot() -> wreq::Client {
    paced(Pace::Patient, 0)
}

async fn fetched(client: &wreq::Client, request: FetchRequest) -> (Head, Vec<u8>) {
    perform(client, &one_shot(), request).await
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
    let ((stalled, _), (queued, body)) = tokio::join!(fetched(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        fetched(&client, get(&url)).await
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
    let (head, body) = fetched(&client, get(&url)).await;
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
    assert_eq!(accepted.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn each_replay_gets_a_connection_of_its_own() {
    let (url, accepted) = h2_server_then(Mode::Freeze, Mode::CutAfter(1)).await;
    let client = h2_client();
    let started = Instant::now();
    let queued = || async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        fetched(&client, get(&url)).await
    };
    let ((stalled, _), first, second) =
        tokio::join!(fetched(&client, get(&url)), queued(), queued());
    assert!(matches!(stalled, Head::Failed { .. }), "{stalled:?}");
    for (head, body) in [first, second] {
        let Head::Answer {
            status, stalled, ..
        } = head
        else {
            panic!("a replay must not freeze with another one, got {head:?}");
        };
        assert_eq!(status, 200);
        assert!(stalled);
        assert_eq!(body, b"ok");
    }
    assert!(
        started.elapsed() < Duration::from_secs(9),
        "{:?}",
        started.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn a_slow_link_keeps_its_connection_with_the_patient_pings() {
    let lag = Duration::from_millis(7_500);
    let (quick_url, quick_accepted) = h2_server(Mode::Lagging(lag)).await;
    let (patient_url, patient_accepted) = h2_server(Mode::Lagging(lag)).await;
    let quick = h2_client();
    let patient = paced(Pace::Patient, 8);
    let ((dropped, _), (kept, body)) = tokio::join!(
        fetched(&quick, get(&quick_url)),
        fetched(&patient, get(&patient_url))
    );
    assert!(
        matches!(dropped, Head::Answer { stalled: true, .. }),
        "{dropped:?}"
    );
    assert_eq!(quick_accepted.load(Ordering::SeqCst), 2);
    let Head::Answer {
        status, stalled, ..
    } = kept
    else {
        panic!("the patient pings must wait for the slow answer, got {kept:?}");
    };
    assert_eq!(status, 200);
    assert!(!stalled);
    assert_eq!(body, b"ok");
    assert_eq!(patient_accepted.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_get_with_another_hop_left_is_not_replayed() {
    let (url, accepted) = h2_server(Mode::Freeze).await;
    let client = h2_client();
    let mut first_hop = get(&url);
    first_hop.route = Some(Route {
        tier: Tier::Direct,
        origin: "fetch-h2-test.scnative.space".to_string(),
        attempt: 0,
        last: false,
    });
    let started = Instant::now();
    let ((stalled, _), (queued, _)) = tokio::join!(fetched(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        fetched(&client, first_hop).await
    });
    assert!(matches!(stalled, Head::Failed { .. }), "{stalled:?}");
    let Head::Failed { error } = queued else {
        panic!("the next hop must take over instead of a replay, got {queued:?}");
    };
    assert_eq!(error.kind, NetKind::Timeout);
    assert!(
        started.elapsed() < Duration::from_secs(9),
        "{:?}",
        started.elapsed()
    );
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn a_post_queued_on_a_frozen_h2_connection_is_not_replayed() {
    let (url, accepted) = h2_server(Mode::Freeze).await;
    let client = h2_client();
    let ((stalled, _), (queued, _)) = tokio::join!(fetched(&client, get(&url)), async {
        tokio::time::sleep(Duration::from_millis(300)).await;
        fetched(&client, post(&url)).await
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
    let (head, _) = fetched(&client, get(&url)).await;
    assert!(matches!(head, Head::Answer { status: 200, .. }), "{head:?}");
    tokio::time::sleep(Duration::from_millis(4_500)).await;
    let asked = Instant::now();
    let (head, body) = fetched(&client, get(&url)).await;
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
    let (head, body) = fetched(&client, get(&url)).await;
    let Head::Answer { status, .. } = head else {
        panic!("a slow answer must arrive, got {head:?}");
    };
    assert_eq!(status, 200);
    assert_eq!(body, b"ok");
    assert!(started.elapsed() >= Duration::from_secs(7));
    assert_eq!(accepted.load(Ordering::SeqCst), 1);
}
