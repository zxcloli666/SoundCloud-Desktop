use std::future::Future;

use sc_chat::{ChatError, ChatResult, ConversationKind, MediaKind, media};
use serde_json::json;
use tokio::sync::oneshot;

use super::backdrop::disk;
use super::fixtures::ROOM_CODE;
use super::png;
use super::rig::Rig;
use crate::chat::upload::single::Single;

fn held() -> (
    oneshot::Sender<Vec<u8>>,
    impl Future<Output = ChatResult<Vec<u8>>>,
) {
    let (send, wait) = oneshot::channel();
    (
        send,
        async move { wait.await.map_err(|_| ChatError::Internal) },
    )
}

async fn turn_taken(rig: &Rig, turn: u64) {
    rig.until("the pick to take its turn", |rig| {
        rig.uploads.turns.holds(rig.conversation, turn)
    })
    .await;
}

fn nothing_started(rig: &Rig) -> bool {
    rig.uploads().is_empty()
        && rig.upload_files().is_empty()
        && rig.world.with(|state| state.reserves.is_empty())
}

#[tokio::test(flavor = "multi_thread")]
async fn a_preset_picked_while_a_stored_image_loads_wins() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    let (send, original) = held();
    let uploads = rig.uploads.clone();
    let pick = tokio::spawn(async move { uploads.backdrop(ROOM_CODE, room, original).await });
    turn_taken(&rig, 1).await;
    rig.uploads
        .set_backdrop(ROOM_CODE, room, Some("dusk".into()))
        .await
        .unwrap();
    let _ = send.send(png::noisy(800, 450, 81));
    assert_eq!(pick.await.unwrap(), Ok(None));
    assert!(nothing_started(&rig));
    let settings = rig.world.with(|state| state.settings.clone());
    assert_eq!(settings.len(), 1);
    assert_eq!(
        settings[0].1["backdrop"],
        json!({"kind": "preset", "id": "dusk"})
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stopped_pick_uploads_nothing_when_its_image_arrives() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    let (send, original) = held();
    let uploads = rig.uploads.clone();
    let pick = tokio::spawn(async move { uploads.backdrop(ROOM_CODE, room, original).await });
    turn_taken(&rig, 1).await;
    rig.uploads.stop_backdrop(room).await.unwrap();
    let _ = send.send(png::noisy(800, 450, 82));
    assert_eq!(pick.await.unwrap(), Ok(None));
    assert!(nothing_started(&rig));
    assert!(rig.world.with(|state| state.calls.is_empty()));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_later_pick_replaces_a_slower_one_whatever_lands_first() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    let (send, original) = held();
    let uploads = rig.uploads.clone();
    let slow = tokio::spawn(async move { uploads.backdrop(ROOM_CODE, room, original).await });
    turn_taken(&rig, 1).await;
    let fast = rig
        .uploads
        .backdrop(ROOM_CODE, room, disk(&rig, 83))
        .await
        .unwrap()
        .unwrap();
    let _ = send.send(png::noisy(800, 450, 84));
    assert_eq!(slow.await.unwrap(), Ok(None));
    let rows = rig.uploads();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, fast.id);
    assert_eq!(rig.upload_files().len(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stop_that_lands_after_the_pick_was_queued_drops_the_upload() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    rig.uploads
        .backdrop(ROOM_CODE, room, disk(&rig, 85))
        .await
        .unwrap()
        .unwrap();
    rig.uploads.stop_backdrop(room).await.unwrap();
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    assert!(rig.world.with(|state| state.settings.is_empty()));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_prepared_pick_that_lost_its_turn_keeps_the_newer_upload() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    let stale = rig.uploads.turns.take(room);
    let fresh = rig
        .uploads
        .backdrop(ROOM_CODE, room, disk(&rig, 86))
        .await
        .unwrap()
        .unwrap();
    let prepared = media::prepare_backdrop(&png::noisy(800, 450, 87)).unwrap();
    let late = rig
        .uploads
        .enqueue_single(Single {
            conversation_id: room,
            kind: MediaKind::Backdrop,
            image: prepared.image,
            attachment: prepared.attachment,
            turn: Some(stale),
        })
        .await;
    assert_eq!(late, Ok(None));
    let rows = rig.uploads();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, fresh.id);
    assert_eq!(rig.upload_files().len(), 1);
}
