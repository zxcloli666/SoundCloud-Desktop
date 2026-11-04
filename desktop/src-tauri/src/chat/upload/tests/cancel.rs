use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::media::post_media;
use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{ConversationKind, UploadState};
use serde_json::json;
use uuid::Uuid;

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

fn left(rig: &Rig) -> Vec<(Uuid, u32)> {
    rig.uploads()
        .iter()
        .map(|upload| (upload.id, upload.position))
        .collect()
}

fn placeholders(rig: &Rig, album: Uuid) -> Vec<String> {
    let parked = rig
        .outbox()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    envelope(&parked)
        .attachments
        .into_iter()
        .map(|attachment| attachment.media_id)
        .collect()
}

#[tokio::test(flavor = "multi_thread")]
async fn removing_the_middle_first_and_last_image_keeps_the_rest_in_order() {
    let rig = Rig::new(ConversationKind::Group);
    let paths = (101..105).map(|seed| rig.image(seed)).collect();
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(paths))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("four, then one"), album)
        .await
        .unwrap();
    let ids: Vec<Uuid> = views.iter().map(|view| view.id).collect();
    for (removed, kept) in [(1, vec![0, 2, 3]), (0, vec![2, 3]), (3, vec![2])] {
        rig.uploads.cancel(ids[removed]).await.unwrap();
        let expected: Vec<(Uuid, u32)> = kept.iter().map(|at| (ids[*at], *at as u32)).collect();
        assert_eq!(left(&rig), expected);
        assert_eq!(rig.upload_files().len(), 2 * kept.len());
        let shown: Vec<String> = kept.iter().map(|at| ids[*at].to_string()).collect();
        assert_eq!(placeholders(&rig, album), shown);
    }
    rig.uploads.cancel(ids[1]).await.unwrap();
    assert_eq!(left(&rig), [(ids[2], 2)]);
    let more = rig
        .uploads
        .attach(rig.conversation, Some(album), sources(vec![rig.image(105)]))
        .await
        .unwrap();
    assert_eq!(more[0].position, 3);
    let shown = vec![ids[2].to_string(), more[0].id.to_string()];
    assert_eq!(placeholders(&rig, album), shown);
}

#[tokio::test(flavor = "multi_thread")]
async fn removing_an_image_mid_put_aborts_it_and_the_album_goes_out_without_it() {
    let mut rig = Rig::new(ConversationKind::Group);
    let (stuck, hits) = rig.answering(200, 0, Duration::from_secs(100));
    rig.route(vec![Path::Relay(stuck)]);
    rig.world.pass();
    rig.world
        .refuse(503, json!({"error": "chat_media_uploads_paused"}));
    let views = rig
        .uploads
        .attach(
            rig.conversation,
            None,
            sources(vec![rig.image(106), rig.image(107)]),
        )
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("one of two"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the first put to hang", |_| {
        hits.load(Ordering::SeqCst) == 1
    })
    .await;
    rig.uploads.cancel(views[0].id).await.unwrap();
    rig.until("the second image to wait", |rig| {
        !rig.host.errors.lock().unwrap().is_empty()
    })
    .await;
    assert_eq!(left(&rig), [(views[1].id, 1)]);
    let reserved = rig.world.reservation(views[0].id).unwrap();
    assert!(
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    );
    assert_eq!(placeholders(&rig, album), [views[1].id.to_string()]);
    assert_eq!(rig.upload_files().len(), 2);
    rig.relays();
    rig.uploads.wake_all();
    rig.until("the rest of the album", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let sent = rig
        .due()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    let images = post_media(&envelope(&sent).attachments).unwrap();
    let second = rig.world.reservation(views[1].id).unwrap();
    assert_eq!(images, [second.image]);
    assert_eq!(hits.load(Ordering::SeqCst), 1);
    rig.until("the rows and files to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
}
