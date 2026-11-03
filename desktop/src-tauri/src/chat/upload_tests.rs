use sc_chat::sc_chat_wire::proto::{Attachment, Thumb};
use sc_chat::store::{MediaUpload, UploadObject, UploadState};
use uuid::Uuid;

use super::upload::{UploadPart, UploadStage, view_of};

fn upload(state: UploadState, object: UploadObject) -> MediaUpload {
    MediaUpload {
        id: Uuid::from_u128(1),
        album: Uuid::from_u128(2),
        position: 3,
        conversation_id: Uuid::from_u128(4),
        image_ref: "image".into(),
        thumb_ref: "thumb".into(),
        attachment: Attachment {
            size: 151_552,
            thumb: Some(Thumb {
                size: 24_576,
                ..Default::default()
            }),
            ..Default::default()
        },
        state,
        object,
        media_id: None,
        stage_id: None,
        parts_sent: 7,
        presign_expires_at: None,
        attempts: 2,
        created_at: 1_000,
        updated_at: 2_000,
    }
}

#[test]
fn a_view_counts_image_and_thumb_bytes() {
    let view = view_of(&upload(UploadState::Uploading, UploadObject::Thumb));
    assert_eq!(view.bytes, 176_128);
    assert_eq!(view.stage, UploadStage::Uploading);
    assert_eq!(view.part, UploadPart::Thumb);
    assert_eq!(view.parts_sent, 7);
    assert_eq!(view.attempts, 2);
}

#[test]
fn a_view_serializes_for_the_webview() {
    let view = view_of(&upload(UploadState::Failed, UploadObject::Image));
    let json = serde_json::to_value(&view).unwrap();
    assert_eq!(json["stage"], "failed");
    assert_eq!(json["part"], "image");
    assert_eq!(json["partsSent"], 7);
    assert_eq!(json["conversationId"], Uuid::from_u128(4).to_string());
}
