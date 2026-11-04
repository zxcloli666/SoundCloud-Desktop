use std::time::Duration;

use tokio::sync::watch;

use super::fake_relay::{self, FakeRelay, Kind};
use super::faulty_link::{self, Fault};
use super::put::Filled;
use super::stage::holes;
use super::{Asked, StagedFailure, Staging, fill_stage, open_filled};

const BODY: usize = 90 * 1024;

fn body(len: usize) -> Vec<u8> {
    (0..len).map(|at| (at * 7 % 253) as u8).collect()
}

fn put() -> Asked {
    Asked {
        method: "PUT".to_string(),
        url: "https://s3.scnative.dev/scd-chat/m/0a1b?X-Amz-Signature=x".to_string(),
        headers: vec![("content-length".to_string(), BODY.to_string())],
        body: None,
    }
}

async fn carried(node: &str, body: &[u8]) -> Result<u16, StagedFailure> {
    let (progress, _seen) = watch::channel(Staging::default());
    let filled = fill_stage(node, body, None, &progress).await?;
    open_filled(node, &put(), body, &filled, &progress).await
}

fn delivered_once(relay: &FakeRelay, body: &[u8]) {
    assert_eq!(relay.delivered(), [body.to_vec()]);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_body_of_8_kb_or_less_opens_inline_without_a_stage() {
    let relay = fake_relay::serve(Kind::Staging);
    let small = body(8 * 1024);
    assert_eq!(carried(&relay.url, &small).await, Ok(200));
    delivered_once(&relay, &small);
    assert_eq!(relay.stages_opened(), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stage_that_idled_out_before_the_open_is_staged_again_on_the_same_node() {
    let relay = fake_relay::serve(Kind::Staging);
    relay.idle(Duration::from_millis(150));
    let sent = body(BODY);
    let (progress, _seen) = watch::channel(Staging::default());
    let filled = fill_stage(&relay.url, &sent, None, &progress)
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(300)).await;
    let opened = open_filled(&relay.url, &put(), &sent, &filled, &progress).await;
    assert_eq!(opened, Ok(200));
    delivered_once(&relay, &sent);
    assert_eq!(relay.stages_opened(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_origin_blip_after_the_node_took_the_stage_fills_a_new_one_from_memory() {
    let relay = fake_relay::serve(Kind::Staging);
    relay.fail_opens(1);
    let sent = body(BODY);
    assert_eq!(carried(&relay.url, &sent).await, Ok(200));
    delivered_once(&relay, &sent);
    assert_eq!((relay.stages_opened(), relay.opens()), (2, 2));
}

#[tokio::test(flavor = "multi_thread")]
async fn an_incomplete_stage_is_topped_up_and_then_opens() {
    let relay = fake_relay::serve(Kind::ForgetsOnce);
    let sent = body(BODY);
    assert_eq!(carried(&relay.url, &sent).await, Ok(200));
    delivered_once(&relay, &sent);
    assert_eq!((relay.stages_opened(), relay.opens()), (1, 2));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stored_stage_the_node_no_longer_has_is_staged_anew() {
    let relay = fake_relay::serve(Kind::Staging);
    let sent = body(BODY);
    let (progress, seen) = watch::channel(Staging::default());
    let filled = fill_stage(&relay.url, &sent, Some("gone"), &progress)
        .await
        .unwrap();
    assert_eq!(filled, Filled::Stage("stage-1".to_string()));
    assert_eq!(seen.borrow().sent, BODY as u64);
    assert_eq!(relay.stages_opened(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_full_node_fails_the_hop_instead_of_sending_the_body_inline() {
    let relay = fake_relay::serve(Kind::Staging);
    relay.refuse_stages(503);
    let failed = carried(&relay.url, &body(BODY)).await;
    assert!(matches!(failed, Err(StagedFailure::Link(_))));
    assert_eq!(relay.opens(), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_node_without_stages_gets_the_body_inline() {
    let relay = fake_relay::serve(Kind::Old);
    let sent = body(BODY);
    assert_eq!(carried(&relay.url, &sent).await, Ok(200));
    delivered_once(&relay, &sent);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_node_that_keeps_refusing_opens_fails_with_its_answer() {
    let relay = fake_relay::serve(Kind::RefusesOpen);
    let failed = carried(&relay.url, &body(BODY)).await;
    assert_eq!(
        failed,
        Err(StagedFailure::Link("pro: open answered 429".to_string()))
    );
    assert_eq!(relay.opens(), 3);
    assert!(relay.delivered().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_lost_open_answer_is_checked_on_the_node_and_the_put_goes_again() {
    let relay = fake_relay::serve(Kind::Staging);
    let node = faulty_link::link(&relay.url, Fault::LoseOpenAnswers(1)).await;
    let sent = body(BODY);
    assert_eq!(carried(&node, &sent).await, Ok(200));
    assert_eq!(relay.delivered(), [sent.clone(), sent]);
    assert_eq!(relay.stages_opened(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_cut_link_still_fills_the_stage_and_progress_only_grows() {
    let relay = fake_relay::serve(Kind::Staging);
    let (node, cuts) = faulty_link::counted(&relay.url, Fault::Cut(16 * 1024)).await;
    let sent = body(BODY);
    let (progress, mut seen) = watch::channel(Staging::default());
    let watched = tokio::spawn(async move {
        let mut marks = Vec::new();
        while seen.changed().await.is_ok() {
            marks.push(seen.borrow_and_update().sent);
        }
        marks
    });
    let filled = fill_stage(&node, &sent, None, &progress).await.unwrap();
    let opened = open_filled(&node, &put(), &sent, &filled, &progress).await;
    drop(progress);
    assert_eq!(opened, Ok(200));
    delivered_once(&relay, &sent);
    assert!(cuts.load(std::sync::atomic::Ordering::SeqCst) > 0);
    let marks = watched.await.unwrap();
    assert!(marks.windows(2).all(|pair| pair[0] <= pair[1]));
    assert_eq!(marks.last(), Some(&(BODY as u64)));
}

#[test]
fn stage_holes_come_back_sorted_merged_and_capped() {
    let unsorted = [[60, 80], [0, 10], [5, 20], [20, 30]];
    assert_eq!(holes(&unsorted, 100, 100).unwrap(), [0..30, 60..80]);
    let scattered: Vec<[u64; 2]> = (0..300).map(|at| [at * 3, at * 3 + 1]).collect();
    assert!(holes(&scattered, 1000, 1000).is_err());
}
