use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{ConversationKind, UploadState};
use serde_json::json;

use super::albums::sources;
use super::rig::{Path, Rig, envelope};

#[tokio::test(flavor = "multi_thread")]
async fn cancelling_an_album_drops_rows_files_the_parked_post_and_frees_the_server_rows() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            sources(vec![rig.image(71), rig.image(72)]),
        )
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("never"), album)
        .await
        .unwrap();
    rig.world.pass();
    rig.world
        .refuse(503, json!({"error": "chat_media_uploads_paused"}));
    rig.run();
    rig.until("the first image to land", |rig| {
        rig.uploads()
            .iter()
            .any(|upload| upload.state == UploadState::Uploaded)
    })
    .await;
    assert!(rig.world.with(|state| state.commits.is_empty()));
    rig.uploads.cancel_album(album).await.unwrap();
    assert!(rig.uploads().is_empty());
    assert!(rig.outbox().is_empty());
    assert!(rig.upload_files().is_empty());
    let reserved = rig.world.with(|state| {
        state
            .reservations
            .iter()
            .map(|reservation| reservation.image)
            .collect::<Vec<_>>()
    });
    let deleted = rig.world.with(|state| state.deleted.clone());
    assert!(!reserved.is_empty());
    assert!(reserved.iter().all(|image| deleted.contains(image)));
}

#[tokio::test(flavor = "multi_thread")]
async fn cancelling_the_only_image_of_a_parked_post_with_text_sends_the_text() {
    let rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(81)]))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("words stay"), album)
        .await
        .unwrap();
    rig.uploads.cancel(views[0].id).await.unwrap();
    let due = rig.due();
    assert_eq!(due.len(), 1);
    let sent = envelope(&due[0]);
    assert!(sent.attachments.is_empty());
    assert!(matches!(sent.body, Some(Body::Text(ref text)) if text.text == "words stay"));
    assert!(rig.uploads().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn cancelling_the_only_image_of_a_parked_post_without_text_drops_the_post() {
    let rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(82)]))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads.send_album(rig.post(" "), album).await.unwrap();
    rig.uploads.cancel(views[0].id).await.unwrap();
    assert!(rig.outbox().is_empty());
    assert!(rig.upload_files().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn cancelling_an_image_mid_put_stops_the_put_and_the_queue_goes_on() {
    let mut rig = Rig::new(ConversationKind::Group);
    let (stuck, hits) = rig.answering(200, 0, Duration::from_secs(100));
    rig.route(vec![Path::Relay(stuck)]);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(73)]))
        .await
        .unwrap();
    rig.run();
    rig.until("the put to hang", |_| hits.load(Ordering::SeqCst) == 1)
        .await;
    rig.uploads.cancel(views[0].id).await.unwrap();
    rig.until("the step to stop", |rig| {
        rig.uploads.current.lock().unwrap().is_none()
    })
    .await;
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    let reserved = rig.world.with(|state| state.reservations[0].image);
    assert!(rig.world.with(|state| state.deleted.contains(&reserved)));
    rig.relays();
    rig.uploads
        .attach(rig.conversation, None, sources(vec![rig.image(74)]))
        .await
        .unwrap();
    rig.until("the next image", |rig| {
        rig.uploads()
            .first()
            .is_some_and(|upload| upload.state == UploadState::Uploaded)
    })
    .await;
}
