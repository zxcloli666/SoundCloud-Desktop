use sc_chat::{ChatResult, ConvId, MediaUploadView, ReportReason};
use uuid::Uuid;

use super::download;
use super::state::ChatState;
use super::upload::{chosen, read_source};

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
) -> ChatResult<Option<MediaUploadView>> {
    let path = chosen(state, path).await?;
    state
        .uploads
        .backdrop(&code, conversation_id, read_source(&path))
        .await
}

pub async fn upload_stored(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    source: ConvId,
    media_id: Uuid,
) -> ChatResult<Option<MediaUploadView>> {
    let original = download::original(state, source, media_id);
    state
        .uploads
        .backdrop(&code, conversation_id, original)
        .await
}

pub async fn stop(state: &ChatState, conversation_id: ConvId) -> ChatResult<()> {
    state.uploads.stop_backdrop(conversation_id).await
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
