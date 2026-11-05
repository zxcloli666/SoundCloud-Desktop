use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;

use sc_chat::{ChatError, ConvId, ConversationKind, MediaKind};
use serde_json::json;
use uuid::Uuid;

use super::albums::sources;
use super::fixtures::{ROOM_CODE, summary};
use super::rig::{Rig, envelope};
use crate::chat::download::tests::rig::Rig as Shelf;
use crate::chat::download::{Downloads, MediaRef, Notice, Part, keyed};
use crate::network::edge::{Hop, Tier};

async fn sent_image(rig: &mut Rig) -> Uuid {
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(71)]))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("kept"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the post", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let item = rig
        .due()
        .into_iter()
        .find(|item| item.client_id == album)
        .unwrap();
    let media_id = Uuid::parse_str(&envelope(&item).attachments[0].media_id).unwrap();
    rig.ack(album);
    rig.until("the rows and files to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
    media_id
}

fn room_beside(rig: &Rig) -> ConvId {
    let room = Uuid::new_v4();
    rig.store()
        .put_conversations(&[summary(room, ConversationKind::Room)])
        .unwrap();
    room
}

fn image_settings(rig: &Rig) -> Vec<serde_json::Value> {
    rig.world.with(|state| {
        state
            .settings
            .iter()
            .map(|(_, body)| body["backdrop"].clone())
            .collect()
    })
}

#[tokio::test(flavor = "multi_thread")]
async fn an_image_sent_from_here_becomes_a_room_backdrop_straight_from_the_cache() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let group = rig.conversation;
    let media_id = sent_image(&mut rig).await;
    let room = room_beside(&rig);
    let stranger = Uuid::new_v4();
    let offered = keyed(
        &rig.store(),
        &[
            MediaRef {
                conversation_id: group,
                media_id: stranger,
            },
            MediaRef {
                conversation_id: room,
                media_id,
            },
            MediaRef {
                conversation_id: group,
                media_id,
            },
        ],
    )
    .unwrap();
    assert_eq!(offered, [media_id]);
    let (origin, gets) = rig.answering(500, 0, Duration::ZERO);
    let notice: Notice = Arc::new(|_| {});
    let routes = Arc::new(move |_: &str| {
        vec![Hop {
            url: origin.clone(),
            tier: Tier::Relay,
            origin: String::new(),
        }]
    });
    let downloads = Arc::new(Downloads::routed(
        rig.uploads.api.clone(),
        rig.cache.clone(),
        notice,
        routes,
    ));
    let attachment = rig.store().attachment(group, media_id).unwrap();
    let original = downloads.original(group, media_id, attachment);
    let view = rig
        .uploads
        .backdrop(ROOM_CODE, room, original)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        (view.kind, view.conversation_id),
        (MediaKind::Backdrop, room)
    );
    assert_eq!(gets.load(Ordering::SeqCst), 0);
    rig.until("the backdrop meta", |rig| {
        rig.due().iter().any(|item| item.conversation_id == room)
    })
    .await;
    let reserved = rig.world.reservation(view.id).unwrap();
    assert!(reserved.committed && reserved.thumb.is_none());
    assert_eq!(
        image_settings(&rig),
        [json!({"kind": "image", "mediaId": reserved.image})]
    );
    rig.until("the backdrop row and file to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_stored_image_missing_here_is_downloaded_once_kept_and_sealed_anew() {
    let shelf = Shelf::new();
    let media = shelf.uploaded(72);
    let rig = Rig::new(ConversationKind::Room);
    let original = shelf.downloads.original(
        shelf.conversation,
        media.image_id,
        Some(media.attachment.clone()),
    );
    let view = rig
        .uploads
        .backdrop(ROOM_CODE, rig.conversation, original)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(view.kind, MediaKind::Backdrop);
    assert_eq!(shelf.world.gets_of(media.image_id), 1);
    assert_eq!(
        shelf.cache.get(media.image_id, Part::Image).unwrap(),
        Some(media.image.clone())
    );
    let rows = rig.uploads();
    assert_eq!(rows.len(), 1);
    assert_ne!(rows[0].attachment.key, media.attachment.key);
    assert_eq!(rig.upload_files().len(), 1);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_deleted_lost_or_unknown_stored_image_is_missing_and_starts_nothing() {
    let shelf = Shelf::new();
    let deleted = shelf.uploaded(73);
    let lost = shelf.uploaded(74);
    let unknown = shelf.media(75);
    shelf.world.with(|state| {
        state.gone.insert(deleted.image_id, "deleted");
        state.gone.insert(lost.image_id, "lost");
    });
    let rig = Rig::new(ConversationKind::Room);
    let cases = [
        (deleted.image_id, Some(deleted.attachment.clone())),
        (lost.image_id, Some(lost.attachment.clone())),
        (unknown.image_id, None),
    ];
    for (media_id, attachment) in cases {
        let original = shelf
            .downloads
            .original(shelf.conversation, media_id, attachment);
        let failed = rig
            .uploads
            .backdrop(ROOM_CODE, rig.conversation, original)
            .await;
        assert_eq!(
            failed,
            Err(ChatError::MediaMissing {
                ids: vec![media_id]
            })
        );
    }
    assert_eq!(shelf.world.urls_calls().len(), 2);
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    assert!(rig.world.with(|state| state.calls.is_empty()));
}

#[tokio::test(flavor = "multi_thread")]
async fn an_unreachable_stored_image_is_offline_and_works_on_retry() {
    let shelf = Shelf::new();
    let media = shelf.uploaded(76);
    let rig = Rig::new(ConversationKind::Room);
    let pick = || {
        shelf.downloads.original(
            shelf.conversation,
            media.image_id,
            Some(media.attachment.clone()),
        )
    };
    shelf.route(&[&shelf.world.dead.clone()]);
    let offline = rig
        .uploads
        .backdrop(ROOM_CODE, rig.conversation, pick())
        .await;
    assert_eq!(offline, Err(ChatError::Offline));
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    shelf.route(&[&shelf.world.s3.clone()]);
    let view = rig
        .uploads
        .backdrop(ROOM_CODE, rig.conversation, pick())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(rig.uploads()[0].id, view.id);
}
