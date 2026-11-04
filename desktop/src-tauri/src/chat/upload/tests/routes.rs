use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::{ChatError, ConversationKind, UploadState};

use super::albums::sources;
use super::rig::{Path, Rig};
use crate::chat::upload::errors::Snag;
use crate::network::pro::fake_relay::{self, Kind};

async fn uploaded(rig: &mut Rig, seed: u64) -> uuid::Uuid {
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(seed)]))
        .await
        .unwrap();
    rig.run();
    rig.until("the upload", |rig| {
        rig.uploads()
            .first()
            .is_some_and(|upload| upload.state == UploadState::Uploaded)
    })
    .await;
    views[0].id
}

#[tokio::test(flavor = "multi_thread")]
async fn a_full_pro_node_hands_the_object_to_the_relay_behind_it() {
    let mut rig = Rig::new(ConversationKind::Group);
    let full = fake_relay::serve(Kind::Forwards);
    full.refuse_stages(503);
    rig.route(vec![
        Path::Pro(full.url.clone()),
        Path::Relay(rig.world.s3.clone()),
    ]);
    let id = uploaded(&mut rig, 51).await;
    let reserved = rig.world.reservation(id).unwrap();
    assert_eq!(rig.world.puts_of(reserved.image), 1);
    assert_eq!(rig.world.with(|state| state.reserves.clone()), [id]);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_presign_renewed_inside_a_pro_attempt_is_the_one_the_next_relay_gets() {
    let mut rig = Rig::new(ConversationKind::Group);
    let refusing = fake_relay::serve(Kind::RefusesOpen);
    let host = rig.host.clone();
    refusing.on_first_part(move || {
        host.now.fetch_add(600_000, Ordering::SeqCst);
    });
    rig.route(vec![
        Path::Pro(refusing.url.clone()),
        Path::Relay(rig.world.s3.clone()),
    ]);
    let id = uploaded(&mut rig, 52).await;
    let reserved = rig.world.reservation(id).unwrap();
    assert_eq!(rig.world.with(|state| state.reserves.clone()), [id, id]);
    assert_eq!(rig.world.with(|state| state.forbidden), 0);
    assert_eq!(rig.world.puts_of(reserved.image), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_403_next_to_a_dead_hop_waits_for_the_link_instead_of_signing_again() {
    let mut rig = Rig::new(ConversationKind::Group);
    let (refusing, refused) = rig.answering(403, 0, Duration::ZERO);
    let (dead, died) = rig.answering(502, 0, Duration::ZERO);
    rig.route(vec![Path::Relay(refusing), Path::Relay(dead)]);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(53)]))
        .await
        .unwrap();
    rig.run();
    rig.until("both hops", |_| {
        refused.load(Ordering::SeqCst) > 0 && died.load(Ordering::SeqCst) > 0
    })
    .await;
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(
        rig.world.with(|state| state.reserves.clone()),
        [views[0].id]
    );
    assert!(rig.host.errors.lock().unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_presign_on_a_host_with_no_route_is_a_protocol_error() {
    let rig = Rig::new(ConversationKind::Group);
    rig.route(Vec::new());
    rig.uploads
        .attach(rig.conversation, None, sources(vec![rig.image(54)]))
        .await
        .unwrap();
    let next = rig.store().next_upload().unwrap().unwrap();
    let stepped = rig.uploads.step(next).await;
    assert_eq!(stepped, Err(Snag::Failed(ChatError::Protocol)));
}
