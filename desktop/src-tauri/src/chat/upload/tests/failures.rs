use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{ChatError, ConversationKind, MessageClass, UploadState};
use serde_json::json;

use super::albums::sources;
use super::rig::{Rig, envelope};

#[tokio::test(flavor = "multi_thread")]
async fn a_commit_that_misses_the_thumb_puts_only_the_thumb_again() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world.with(|state| state.lose_thumbs = 1);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(51)]))
        .await
        .unwrap();
    let album = views[0].album;
    rig.uploads
        .send_album(rig.post("redo"), album)
        .await
        .unwrap();
    rig.run();
    rig.until("the release after a redo", |rig| {
        rig.due().iter().any(|item| item.client_id == album)
    })
    .await;
    let reserved = rig.world.reservation(views[0].id).unwrap();
    assert_eq!(rig.world.puts_of(reserved.image), 1);
    assert_eq!(rig.world.puts_of(reserved.thumb.unwrap()), 2);
    assert_eq!(rig.world.with(|state| state.commits.len()), 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_commit_that_never_finds_its_object_fails_after_a_few_rounds() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world.with(|state| state.lose_thumbs = usize::MAX);
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(52)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.uploads
        .send_album(rig.post("lost"), views[0].album)
        .await
        .unwrap();
    rig.run();
    assert_eq!(
        rig.errors(1).await,
        [(id, ChatError::MediaMissing { ids: Vec::new() })]
    );
    assert_eq!(rig.uploads()[0].state, UploadState::Failed);
    let commits = rig.world.with(|state| state.commits.len());
    assert_eq!(commits, 7);
    assert!(rig.due().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_star_refusal_fails_the_upload_reports_why_and_a_retry_sends_it() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world
        .refuse(403, json!({"error": "chat_media_star_required"}));
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(61)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    assert_eq!(rig.errors(1).await, [(id, ChatError::MediaStarRequired)]);
    assert_eq!(rig.uploads()[0].state, UploadState::Failed);
    rig.uploads.retry(id).await.unwrap();
    rig.until("the upload after a retry", |rig| {
        rig.uploads()[0].state == UploadState::Uploaded
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_full_quota_is_terminal_and_paused_uploads_wait_without_failing() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    rig.world
        .refuse(503, json!({"error": "chat_media_uploads_paused"}));
    rig.world.refuse(
        403,
        json!({"error": "chat_quota_exceeded", "used": 5, "quota": 5}),
    );
    let views = rig
        .uploads
        .attach(rig.conversation, None, sources(vec![rig.image(62)]))
        .await
        .unwrap();
    let id = views[0].id;
    rig.run();
    assert_eq!(rig.errors(1).await, [(id, ChatError::MediaUploadsPaused)]);
    assert_eq!(rig.uploads()[0].state, UploadState::Queued);
    rig.uploads.wake_all();
    assert_eq!(
        rig.errors(2).await,
        [
            (id, ChatError::MediaUploadsPaused),
            (id, ChatError::QuotaExceeded { used: 5, quota: 5 }),
        ]
    );
    assert_eq!(rig.uploads()[0].state, UploadState::Failed);
    assert_eq!(rig.uploads()[0].attempts, 2);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_committed_group_avatar_queues_the_meta_with_its_attachment() {
    let mut rig = Rig::new(ConversationKind::Group);
    rig.relays();
    let path = rig.image(91);
    let view = rig
        .uploads
        .avatar(rig.conversation, path.into())
        .await
        .unwrap();
    assert!(view.thumb_bytes == 0);
    rig.run();
    rig.until("the avatar meta", |rig| !rig.due().is_empty())
        .await;
    let item = rig.due().remove(0);
    assert_eq!(item.class, MessageClass::Meta);
    let meta = envelope(&item);
    let reserved = rig.world.reservation(view.id).unwrap();
    assert_eq!(meta.attachments.len(), 1);
    assert_eq!(meta.attachments[0].media_id, reserved.image.to_string());
    assert!(reserved.thumb.is_none());
    let Some(Body::Meta(snapshot)) = meta.body else {
        panic!("not a meta envelope");
    };
    assert_eq!(snapshot.avatar_media_id, reserved.image.to_string());
    rig.until("the avatar row to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_room_or_a_dm_takes_no_avatar() {
    for kind in [ConversationKind::Room, ConversationKind::Direct] {
        let rig = Rig::new(kind);
        let path = rig.image(92);
        let refused = rig.uploads.avatar(rig.conversation, path.into()).await;
        assert_eq!(refused.err(), Some(ChatError::Invalid));
    }
}
