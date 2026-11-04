use std::time::Duration;

use sc_chat::media::post_media;
use sc_chat::store::NewUpload;
use sc_chat::{ConversationKind, DeliveryState, UploadState};
use uuid::Uuid;

use super::albums::sources;
use super::rig::{Rig, envelope};

const HOUR_AND_MORE: i64 = 61 * 60 * 1000;

fn sent_images(rig: &Rig, album: Uuid) -> Option<Vec<Uuid>> {
    let item = rig.due().into_iter().find(|item| item.client_id == album)?;
    post_media(&envelope(&item).attachments).ok()
}

async fn released(rig: &mut Rig, count: u64) -> (Uuid, Vec<Uuid>) {
    let paths = (0..count).map(|seed| rig.image(seed + 121)).collect();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(paths))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("kept until the server takes it"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the release", |rig| sent_images(rig, album).is_some())
        .await;
    (album, sent_images(rig, album).unwrap())
}

#[tokio::test(flavor = "multi_thread")]
async fn a_post_refused_after_the_attach_window_goes_up_again_and_out_under_the_same_id() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let (album, first) = released(&mut rig, 2).await;
    assert_eq!(rig.uploads().len(), 2);
    assert_eq!(rig.upload_files().len(), 4);

    rig.refuse_send(album);
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(rig.post_state(album), Some(DeliveryState::Failed));
    assert_eq!(rig.world.with(|state| state.reservations.len()), 2);

    rig.advance(HOUR_AND_MORE);
    rig.refuse_send(album);
    rig.until("the post to go out again", |rig| {
        sent_images(rig, album).is_some_and(|images| images.iter().all(|id| !first.contains(id)))
    })
    .await;
    let again = sent_images(&rig, album).unwrap();
    assert_eq!(again.len(), 2);
    assert_eq!(rig.post_state(album), Some(DeliveryState::Pending));
    let deleted = rig.world.with(|state| state.deleted.clone());
    assert!(first.iter().all(|old| deleted.contains(old)));
    assert!(again.iter().all(|new| !deleted.contains(new)));
    for image in &again {
        assert_eq!(rig.world.puts_of(*image), 1);
    }
    assert_eq!(rig.upload_files().len(), 4);

    rig.ack(album);
    rig.until("the rows and files to go after the ack", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
    assert_eq!(rig.world.with(|state| state.reservations.len()), 4);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_restart_between_commit_and_send_keeps_the_files_until_the_server_takes_the_post() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let (album, images) = released(&mut rig, 1).await;
    let mut rig = rig.restart();
    rig.run();
    rig.uploads.kick();
    tokio::time::sleep(Duration::from_millis(300)).await;
    let kept = rig.uploads();
    assert_eq!(kept.len(), 1);
    assert_eq!(kept[0].state, UploadState::Committed);
    assert_eq!(rig.upload_files().len(), 2);
    assert_eq!(sent_images(&rig, album), Some(images));
    assert_eq!(rig.world.with(|state| state.reservations.len()), 1);

    rig.ack(album);
    rig.until("the rows and files to go after the ack", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
    assert!(rig.world.with(|state| state.deleted.is_empty()));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_crash_in_the_middle_of_a_renewal_ends_with_one_row_per_image() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let (album, first) = released(&mut rig, 1).await;
    rig.refuse_send(album);
    rig.stop();
    let old = rig.uploads().remove(0);
    rig.advance(HOUR_AND_MORE);
    let again = NewUpload {
        album,
        position: old.position,
        conversation_id: old.conversation_id,
        kind: old.kind,
        image_ref: old.image_ref.clone(),
        thumb_ref: old.thumb_ref.clone(),
        attachment: old.attachment.clone(),
    };
    rig.store()
        .enqueue_upload(&again, rig.host.now_ms())
        .unwrap();
    let mut rig = rig.restart();
    rig.run();
    rig.until("one row per image and the post out again", |rig| {
        rig.uploads().len() == 1 && sent_images(rig, album).is_some_and(|images| images != first)
    })
    .await;
    assert!(rig.uploads().iter().all(|upload| upload.id != old.id));
    assert_eq!(rig.upload_files().len(), 2);
}
