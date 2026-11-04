use std::path::PathBuf;

use sc_chat::{ChatResult, ConvId, MediaUploadView, ReportReason};
use uuid::Uuid;

use super::state::ChatState;

pub async fn set_preset(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    preset: Option<String>,
) -> ChatResult<()> {
    state
        .uploads
        .set_backdrop(&code, conversation_id, preset)
        .await
}

pub async fn upload(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    path: String,
) -> ChatResult<MediaUploadView> {
    state
        .uploads
        .backdrop(&code, conversation_id, PathBuf::from(path))
        .await
}

pub async fn report(
    state: &ChatState,
    conversation_id: ConvId,
    media_id: Uuid,
    reason: ReportReason,
    comment: Option<String>,
) -> ChatResult<()> {
    state
        .uploads
        .report_backdrop(conversation_id, media_id, reason, comment)
        .await
}
