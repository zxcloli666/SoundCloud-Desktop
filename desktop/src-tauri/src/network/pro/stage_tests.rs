use std::time::Duration;

use futures_util::StreamExt;

use super::fake_relay::{self, Kind};
use super::faulty_link::{self, Fault};
use super::stage::{holes, part_size, parts};
use super::{Asked, fetch};

const SEALED: usize = 60 * 1024;
const CUT: usize = 16 * 1024;

fn sealed(len: usize) -> Vec<u8> {
    let mut state = 0x9e37_79b9_7f4a_7c15_u64;
    (0..len)
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state as u8
        })
        .collect()
}

fn sent(body: Vec<u8>) -> Asked {
    Asked {
        method: "POST".to_string(),
        url: "https://api.scnative.dev/chat/x".to_string(),
        headers: vec![(
            "content-type".to_string(),
            "application/octet-stream".to_string(),
        )],
        body: Some(body),
    }
}

async fn answered(node: &str, body: Vec<u8>) -> Result<Vec<u8>, String> {
    let mut answer = fetch(node, sent(body)).await?;
    let mut collected = Vec::new();
    while let Some(piece) = answer.body.next().await {
        collected.extend_from_slice(&piece?);
    }
    Ok(collected)
}

#[tokio::test(flavor = "multi_thread")]
async fn a_body_over_8_kb_goes_up_as_a_stage_and_reaches_the_origin_once() {
    let relay = fake_relay::serve(Kind::Staging);
    let body = sealed(SEALED);
    assert_eq!(answered(&relay.url, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
    assert_eq!(relay.stages_opened(), 1);
    assert!(relay.parts() >= 2);
    assert_eq!(relay.stages_left(), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_60_kb_sealed_body_crosses_a_link_that_drops_every_16_kb() {
    let relay = fake_relay::serve(Kind::Staging);
    let node = faulty_link::link(&relay.url, Fault::Cut(CUT)).await;
    let body = sealed(SEALED);
    assert_eq!(answered(&node, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
    assert_eq!(relay.stages_left(), 0);
    assert!(part_size() <= CUT);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_that_stalls_after_16_kb_still_fills_the_stage() {
    let relay = fake_relay::serve(Kind::Staging);
    let node = faulty_link::link(&relay.url, Fault::Stall(CUT)).await;
    let body = sealed(SEALED);
    assert_eq!(answered(&node, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_body_of_8_kb_or_less_is_sent_inline() {
    let relay = fake_relay::serve(Kind::Staging);
    let body = sealed(8 * 1024);
    assert_eq!(answered(&relay.url, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
    assert_eq!(relay.stages_opened(), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_old_relay_without_stages_gets_the_body_inline() {
    let relay = fake_relay::serve(Kind::Old);
    let body = sealed(20 * 1024);
    assert_eq!(answered(&relay.url, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_inline_body_cannot_cross_the_link_a_stage_crosses() {
    let relay = fake_relay::serve(Kind::Old);
    let node = faulty_link::link(&relay.url, Fault::Cut(CUT)).await;
    assert!(answered(&node, sealed(SEALED)).await.is_err());
    assert!(relay.delivered().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_staged_request_whose_answer_was_lost_is_not_sent_twice() {
    let relay = fake_relay::serve(Kind::Staging);
    let node = faulty_link::link(&relay.url, Fault::LoseOpenAnswers(1)).await;
    let body = sealed(SEALED);
    assert!(answered(&node, body.clone()).await.is_err());
    assert_eq!(relay.delivered(), [body]);
    assert_eq!(relay.opens(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stage_the_relay_finds_incomplete_is_topped_up_before_it_opens() {
    let relay = fake_relay::serve(Kind::ForgetsOnce);
    let body = sealed(SEALED);
    assert_eq!(answered(&relay.url, body.clone()).await.unwrap(), body);
    assert_eq!(relay.delivered(), [body]);
    assert_eq!(relay.opens(), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stage_the_relay_refuses_to_open_is_deleted() {
    let relay = fake_relay::serve(Kind::RefusesOpen);
    assert!(answered(&relay.url, sealed(SEALED)).await.is_err());
    for _ in 0..40 {
        if relay.stages_left() == 0 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert_eq!(relay.stages_left(), 0);
    assert!(relay.delivered().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stage_that_vanishes_mid_upload_fails_without_an_inline_resend() {
    let relay = fake_relay::serve(Kind::Vanishes);
    assert!(answered(&relay.url, sealed(SEALED)).await.is_err());
    assert_eq!(relay.opens(), 0);
    assert!(relay.delivered().is_empty());
}

#[test]
fn holes_split_into_parts_that_cover_them_exactly() {
    let missing = [0..70_000, 100_000..100_010];
    assert_eq!(
        parts(&missing, 32 * 1024),
        [0..32_768, 32_768..65_536, 65_536..70_000, 100_000..100_010]
    );
}

#[test]
fn a_stage_answer_that_does_not_fit_the_body_is_refused() {
    assert_eq!(holes(&[[0, 4], [6, 10]], 10, 10).unwrap(), [0..4, 6..10]);
    assert!(holes(&[[0, 11]], 10, 10).is_err());
    assert!(holes(&[[5, 5]], 10, 10).is_err());
    assert!(holes(&[], 9, 10).is_err());
}
