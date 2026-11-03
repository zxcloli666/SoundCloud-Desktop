use sc_chat::store::{MediaUpload, UploadObject, UploadState};
use sc_chat::{ChatError, ChatResult, ConvId, Millis};
use serde::Serialize;
use uuid::Uuid;

use super::state::ChatState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UploadStage {
    Queued,
    Reserved,
    Uploading,
    Uploaded,
    Committed,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UploadPart {
    Image,
    Thumb,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadView {
    pub id: Uuid,
    pub album: Uuid,
    pub position: u32,
    pub conversation_id: ConvId,
    pub stage: UploadStage,
    pub part: UploadPart,
    pub bytes: u64,
    pub parts_sent: u32,
    pub attempts: u32,
    pub created_at: Millis,
}

pub fn view_of(upload: &MediaUpload) -> UploadView {
    let thumb = upload
        .attachment
        .thumb
        .as_ref()
        .map_or(0, |thumb| thumb.size);
    UploadView {
        id: upload.id,
        album: upload.album,
        position: upload.position,
        conversation_id: upload.conversation_id,
        stage: match upload.state {
            UploadState::Queued => UploadStage::Queued,
            UploadState::Reserved => UploadStage::Reserved,
            UploadState::Uploading => UploadStage::Uploading,
            UploadState::Uploaded => UploadStage::Uploaded,
            UploadState::Committed => UploadStage::Committed,
            UploadState::Failed => UploadStage::Failed,
        },
        part: match upload.object {
            UploadObject::Image => UploadPart::Image,
            UploadObject::Thumb => UploadPart::Thumb,
        },
        bytes: upload.attachment.size + thumb,
        parts_sent: upload.parts_sent,
        attempts: upload.attempts,
        created_at: upload.created_at,
    }
}

pub async fn enqueue(
    _state: &ChatState,
    _conversation_id: ConvId,
    _paths: Vec<String>,
) -> ChatResult<Vec<UploadView>> {
    Err(ChatError::Unimplemented)
}

pub async fn list(_state: &ChatState) -> ChatResult<Vec<UploadView>> {
    Ok(Vec::new())
}

pub async fn retry(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}

pub async fn cancel(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}
