use sc_chat::media::{post_media, thumb_id};
use sc_chat::{ConversationKind, DeliveryState, UploadState};
use uuid::Uuid;

use super::rig::{Path, Rig, envelope};
use crate::chat::upload::album::PARKED_AT;
use crate::network::pro::fake_relay::{self, Kind};

async fn album(rig: &Rig, count: u64) -> Uuid {
    let paths = (0..count).map(|seed| rig.image(seed + 1)).collect();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(paths))
        .await
        .unwrap();
    assert_eq!(views.len() as u64, count);
    let album = views[0].album;
    assert!(views.iter().all(|view| view.album == album));
    let positions: Vec<u32> = views.iter().map(|view| view.position).collect();
    assert_eq!(positions, (0..count as u32).collect::<Vec<_>>());
    album
}

pub fn sources(paths: Vec<String>) -> Vec<crate::chat::upload::attach::Source> {
    paths
        .into_iter()
        .map(|path| crate::chat::upload::attach::Source::Path(path.into()))
        .collect()
}

async fn released(rig: &Rig, album: Uuid, count: usize) {
    rig.until("the album release", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let item = rig
        .due()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    let envelope = envelope(&item);
    let images = post_media(&envelope.attachments).unwrap();
    assert_eq!(images.len(), count);
    for (attachment, image) in envelope.attachments.iter().zip(&images) {
        let reservation = rig
            .world
            .with(|state| {
                state
                    .reservations
                    .iter()
                    .find(|r| r.image == *image)
                    .cloned()
            })
            .expect("a released id is a reserved image");
        assert!(reservation.committed);
        assert_eq!(thumb_id(attachment).ok(), reservation.thumb);
        assert_eq!(
            rig.world.object(*image).unwrap().len() as u64,
            attachment.size
        );
        assert_eq!(rig.world.puts_of(*image), 1);
    }
    rig.until("the album rows and files to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn an_album_over_relays_parks_its_post_and_sends_it_once_every_image_is_committed() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let album = album(&rig, 3).await;
    let pending = rig
        .uploads
        .send_album(rig.post("three"), album)
        .await
        .unwrap();
    assert_eq!(pending.client_id, album);
    assert_eq!(pending.state, DeliveryState::Pending);
    assert_eq!(pending.attachments.len(), 3);
    let uploads = rig.uploads();
    let shown: Vec<Uuid> = pending.attachments.iter().map(|a| a.media_id).collect();
    let queued: Vec<Uuid> = uploads.iter().map(|upload| upload.id).collect();
    assert_eq!(shown, queued);
    let parked = rig
        .outbox()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    assert_eq!(parked.next_at, PARKED_AT);
    assert!(rig.due().is_empty());

    rig.run();
    released(&rig, album, 3).await;
    assert!(rig.host.sent.load(std::sync::atomic::Ordering::SeqCst) >= 1);
    assert_eq!(rig.world.with(|state| state.chunked_puts), 0);
    assert!(rig.host.errors.lock().unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn an_album_over_pro_stages_every_object_in_parts_and_reaches_the_store() {
    let mut rig = Rig::new(ConversationKind::Group);
    let relay = fake_relay::serve(Kind::Forwards);
    rig.route(vec![Path::Pro(relay.url.clone())]);
    let album = album(&rig, 2).await;
    rig.uploads
        .send_album(rig.post("staged"), album)
        .await
        .unwrap();
    rig.run();
    released(&rig, album, 2).await;
    assert_eq!(relay.stages_opened(), 4);
    assert_eq!(relay.stages_left(), 0);
    assert!(relay.parts() > 4);
}

#[tokio::test(flavor = "multi_thread")]
async fn an_album_committed_before_send_goes_out_at_once() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let album = album(&rig, 2).await;
    rig.run();
    rig.until("both commits", |rig| {
        rig.uploads()
            .iter()
            .all(|upload| upload.state == UploadState::Committed)
    })
    .await;
    assert!(rig.outbox().is_empty());
    let sent = rig.uploads.send_album(rig.post(""), album).await.unwrap();
    assert_eq!(sent.attachments.len(), 2);
    released(&rig, album, 2).await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_retry_of_a_parked_post_keeps_it_parked_and_restarts_failed_images() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world.refuse(
        403,
        serde_json::json!({"error": "chat_media_star_required"}),
    );
    let album = album(&rig, 1).await;
    rig.uploads
        .send_album(rig.post("later"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the refusal", |rig| {
        rig.uploads()[0].state == UploadState::Failed
    })
    .await;
    assert!(rig.due().is_empty());
    let mut again = rig.post("later");
    again.client_id = Some(album);
    let pending = rig.uploads.send_album(again, album).await.unwrap();
    assert_eq!(pending.state, DeliveryState::Pending);
    released(&rig, album, 1).await;
}
