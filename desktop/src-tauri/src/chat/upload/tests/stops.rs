use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{ConversationKind, UploadState};

use super::albums::sources;
use super::rig::{Path, Rig, envelope};
use crate::chat::upload::deletes::DELETES;

#[tokio::test(flavor = "multi_thread")]
async fn a_halt_mid_put_aborts_it_frees_the_server_row_and_starts_nothing_new() {
    let mut rig = Rig::new(ConversationKind::Group);
    let (slow, hits) = rig.answering(200, 0, Duration::from_secs(30));
    rig.route(vec![Path::Relay(slow)]);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(81)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    rig.until("the put to start", |_| hits.load(Ordering::SeqCst) == 1)
        .await;
    rig.uploads.halt().await;
    let reserved = rig.world.reservation(id).unwrap();
    assert!(
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    );
    rig.uploads.wake_all();
    tokio::time::sleep(Duration::from_millis(400)).await;
    assert_eq!(hits.load(Ordering::SeqCst), 1);
    assert_eq!(rig.world.with(|state| state.reserves.len()), 1);
    assert_ne!(rig.uploads()[0].state, UploadState::Uploaded);
}

#[tokio::test(flavor = "multi_thread")]
async fn cancelling_an_image_while_its_commit_is_in_flight_frees_it_and_sends_the_text() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world.hold("/commit", Duration::from_millis(500));
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(82)]))
        .await
        .unwrap();
    let (album, id) = (views[0].album, views[0].id);
    rig.uploads
        .send_album(rig.post("just the words"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the image to land", |rig| {
        rig.uploads()
            .first()
            .is_some_and(|upload| upload.state == UploadState::Uploaded)
    })
    .await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    rig.uploads.cancel(id).await.unwrap();
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    let reserved = rig.world.reservation(id).unwrap();
    rig.until("the server row to be freed", |rig| {
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    })
    .await;
    tokio::time::sleep(Duration::from_millis(600)).await;
    assert!(rig.uploads().is_empty());
    let due = rig.due();
    assert_eq!(due.len(), 1);
    let sent = envelope(&due[0]);
    assert!(sent.attachments.is_empty());
    assert!(matches!(sent.body, Some(Body::Text(ref text)) if text.text == "just the words"));
    assert!(rig.host.errors.lock().unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_server_delete_that_fails_offline_is_kept_on_disk_and_sent_again() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(83)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    rig.until("the image to land", |rig| {
        rig.uploads()
            .first()
            .is_some_and(|upload| upload.state == UploadState::Uploaded)
    })
    .await;
    rig.stop();
    rig.world.with(|state| state.offline_deletes = 1);
    rig.uploads.cancel_album(views[0].album).await.unwrap();
    let reserved = rig.world.reservation(id).unwrap();
    assert!(rig.world.with(|state| state.deleted.is_empty()));
    assert!(rig.dir.join("uploads").join(DELETES).exists());
    rig.run();
    rig.until("the delete to go again", |rig| {
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    })
    .await;
    rig.until("the list to clear", |rig| {
        !rig.dir.join("uploads").join(DELETES).exists()
    })
    .await;
}
