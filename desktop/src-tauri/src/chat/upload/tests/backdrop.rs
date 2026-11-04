use sc_chat::media;
use sc_chat::sc_chat_wire::proto::envelope::Body;
use sc_chat::{
    ChatError, ConversationKind, ConversationMeta, MediaKind, MessageClass, ReportReason,
};
use serde_json::{Value, json};
use uuid::Uuid;

use super::fixtures::ROOM_CODE;
use super::png;
use super::rig::{Rig, envelope};

fn snapshot(rig: &Rig) -> (String, usize) {
    let due = rig.due();
    assert_eq!(due.len(), 1);
    assert_eq!(due[0].class, MessageClass::Meta);
    let meta = envelope(&due[0]);
    let Some(Body::Meta(snapshot)) = meta.body else {
        panic!("not a meta envelope");
    };
    (snapshot.avatar_media_id, meta.attachments.len())
}

fn settings(rig: &Rig) -> Vec<Value> {
    rig.world.with(|state| {
        state
            .settings
            .iter()
            .map(|(code, body)| {
                assert_eq!(code, ROOM_CODE);
                body["backdrop"].clone()
            })
            .collect()
    })
}

#[tokio::test(flavor = "multi_thread")]
async fn a_backdrop_upload_sets_the_room_image_first_and_queues_the_meta_after() {
    let mut rig = Rig::new(ConversationKind::Room);
    rig.relays();
    let path = rig.image(95);
    let elsewhere = rig
        .uploads
        .backdrop("another", rig.conversation, path.clone().into())
        .await;
    assert_eq!(elsewhere.err(), Some(ChatError::Invalid));
    let view = rig
        .uploads
        .backdrop(ROOM_CODE, rig.conversation, path.into())
        .await
        .unwrap();
    assert_eq!((view.kind, view.thumb_bytes), (MediaKind::Backdrop, 0));
    rig.run();
    rig.until("the backdrop meta", |rig| !rig.due().is_empty())
        .await;
    let reserved = rig.world.reservation(view.id).unwrap();
    assert!(reserved.thumb.is_none() && reserved.committed);
    assert_eq!(
        settings(&rig),
        [json!({"kind": "image", "mediaId": reserved.image})]
    );
    let calls = rig.world.with(|state| state.calls.clone());
    let commit = format!("POST /chat/media/{}/commit", reserved.image);
    let set = format!("PUT /chat/rooms/{ROOM_CODE}/settings");
    let at = |call: &str| calls.iter().position(|seen| seen == call).unwrap();
    assert!(at(&commit) < at(&set));
    assert_eq!(snapshot(&rig), (reserved.image.to_string(), 1));
    rig.until("the backdrop row to go", |rig| {
        rig.uploads().is_empty() && rig.upload_files().is_empty()
    })
    .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_preset_drops_a_pending_upload_and_clears_the_image_only_when_there_was_one() {
    let rig = Rig::new(ConversationKind::Room);
    let room = rig.conversation;
    rig.uploads
        .backdrop(ROOM_CODE, room, rig.image(96).into())
        .await
        .unwrap();
    rig.uploads
        .set_backdrop(ROOM_CODE, room, None)
        .await
        .unwrap();
    assert!(rig.uploads().is_empty() && rig.upload_files().is_empty());
    assert!(rig.due().is_empty());
    let mut image = media::prepare_backdrop(&png::noisy(800, 450, 98))
        .unwrap()
        .attachment;
    image.media_id = Uuid::new_v4().to_string();
    let meta = ConversationMeta {
        title: String::new(),
        description: String::new(),
        avatar: Some(image),
    };
    rig.store().put_room_meta(room, Some(&meta)).unwrap();
    rig.uploads
        .set_backdrop(ROOM_CODE, room, Some("dusk".into()))
        .await
        .unwrap();
    assert_eq!(
        settings(&rig),
        [Value::Null, json!({"kind": "preset", "id": "dusk"})]
    );
    assert_eq!(snapshot(&rig), (String::new(), 0));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_refused_backdrop_drops_the_upload_frees_it_and_reports_why() {
    let mut rig = Rig::new(ConversationKind::Room);
    rig.relays();
    rig.world.with(|state| {
        state.settings_refusal = Some((403, json!({"error": "chat_backdrop_cooldown", "until": 1})))
    });
    let view = rig
        .uploads
        .backdrop(ROOM_CODE, rig.conversation, rig.image(97).into())
        .await
        .unwrap();
    rig.run();
    rig.until("the refusal", |rig| {
        let deleted = rig.world.with(|state| !state.deleted.is_empty());
        deleted && !rig.host.errors.lock().unwrap().is_empty() && rig.uploads().is_empty()
    })
    .await;
    assert_eq!(
        *rig.host.errors.lock().unwrap(),
        [(view.id, ChatError::BackdropCooldown { until: 1 })]
    );
    let reserved = rig.world.reservation(view.id).unwrap();
    assert!(
        rig.world
            .with(|state| state.deleted.contains(&reserved.image))
    );
    assert!(rig.due().is_empty() && rig.upload_files().is_empty());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_backdrop_report_files_the_backdrop_kind() {
    let rig = Rig::new(ConversationKind::Room);
    let media = Uuid::new_v4();
    rig.uploads
        .report_backdrop(
            rig.conversation,
            media,
            ReportReason::Spam,
            Some(" ".into()),
        )
        .await
        .unwrap();
    let reports = rig.world.with(|state| state.reports.clone());
    assert_eq!(
        reports,
        [json!({
            "conversation_id": rig.conversation,
            "kind": "backdrop",
            "media_id": media,
            "reason": "spam",
            "comment": null,
        })]
    );
}
