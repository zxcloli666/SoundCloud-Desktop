use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{ConversationKind, UploadState};
use uuid::Uuid;

use super::albums::sources;
use super::rig::{Path, Rig, envelope};
use crate::chat::runtime::{uploads_gone, uploads_present};
use crate::chat::upload::deletes::DELETE_CHUNK;

#[tokio::test(flavor = "multi_thread")]
async fn a_halt_mid_put_aborts_it_queues_the_server_row_and_starts_nothing_new() {
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
    assert_eq!(rig.queued_deletes("100"), vec![reserved.image]);
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
    assert_eq!(rig.queued_deletes("100"), vec![reserved.image]);
    rig.run();
    rig.until("the delete to go again", |rig| {
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    })
    .await;
    rig.until("the list to clear", |rig| {
        rig.queued_deletes("100").is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_wipe_tells_the_webview_every_upload_it_drops() {
    let rig = Rig::new(ConversationKind::Group);
    let views = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            sources(vec![rig.image(85), rig.image(86)]),
        )
        .await
        .unwrap();
    let gone = uploads_gone(&rig.store()).unwrap();
    assert!(gone.uploads.is_empty());
    let mut removed = gone.removed.clone();
    removed.sort();
    let mut attached: Vec<_> = views.iter().map(|view| view.id).collect();
    attached.sort();
    assert_eq!(removed, attached);
    rig.store().wipe().unwrap();
    assert!(uploads_gone(&rig.store()).is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn an_opened_store_tells_the_webview_the_uploads_it_still_holds() {
    let rig = Rig::new(ConversationKind::Group);
    assert!(uploads_present(&rig.store()).uploads.is_empty());
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(87)]))
        .await
        .unwrap();
    let rig = rig.restart();
    let present = uploads_present(&rig.store());
    assert!(present.removed.is_empty());
    assert_eq!(
        present
            .uploads
            .iter()
            .map(|upload| upload.id)
            .collect::<Vec<_>>(),
        vec![views[0].id]
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn a_sign_out_queues_its_deletes_and_only_that_account_sends_them() {
    let mut rig = Rig::new(ConversationKind::Group);
    let (slow, hits) = rig.answering(200, 0, Duration::from_secs(30));
    rig.route(vec![Path::Relay(slow)]);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(84)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    rig.until("the put to start", |_| hits.load(Ordering::SeqCst) == 1)
        .await;
    rig.act_as("200");
    rig.uploads.halt().await;
    rig.stop();
    let reserved = rig.world.reservation(id).unwrap();
    rig.store().wipe().unwrap();
    std::fs::remove_dir_all(rig.dir.join("uploads")).unwrap();
    assert!(rig.world.with(|state| state.delete_batches.is_empty()));
    assert_eq!(rig.queued_deletes("100"), vec![reserved.image]);

    rig.sign_in("200");
    rig.run();
    tokio::time::sleep(Duration::from_millis(600)).await;
    rig.stop();
    assert!(rig.world.with(|state| state.delete_batches.is_empty()));
    assert_eq!(rig.queued_deletes("100"), vec![reserved.image]);

    rig.sign_in("100");
    rig.run();
    rig.until("the left delete to go", |rig| {
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    })
    .await;
    rig.until("the queue to clear", |rig| {
        rig.queued_deletes("100").is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_long_delete_queue_goes_in_chunks_and_keeps_what_was_not_sent() {
    let mut rig = Rig::new(ConversationKind::Group);
    let media: Vec<Uuid> = (0..1201).map(|_| Uuid::new_v4()).collect();
    rig.queue_deletes("100", &media);
    rig.world
        .with(|state| state.deletes_before_offline = Some(1));
    rig.run();
    rig.until("the link to drop after the first chunk", |rig| {
        rig.world
            .with(|state| state.deletes_before_offline.is_none())
    })
    .await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(rig.world.with(|state| state.deleted.len()), DELETE_CHUNK);
    assert_eq!(rig.queued_deletes("100"), media[DELETE_CHUNK..].to_vec());

    rig.world.with(|state| state.offline_deletes = 0);
    rig.uploads.wake_all();
    rig.until("the queue to clear", |rig| {
        rig.queued_deletes("100").is_empty()
    })
    .await;
    let batches = rig.world.with(|state| state.delete_batches.clone());
    assert!(batches.iter().all(|batch| *batch <= DELETE_CHUNK));
    let mut deleted = rig.world.with(|state| state.deleted.clone());
    deleted.sort();
    let mut expected = media.clone();
    expected.sort();
    assert_eq!(deleted, expected);
}
