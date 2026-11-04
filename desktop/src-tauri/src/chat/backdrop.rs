use sc_chat::{ChatError, ChatResult, ConvId, MediaUploadView, ReportReason};
use uuid::Uuid;

use super::state::ChatState;

pub async fn set_preset(
    _state: &ChatState,
    _code: String,
    _conversation_id: ConvId,
    _preset: Option<String>,
) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}

pub async fn upload(
    _state: &ChatState,
    _code: String,
    _conversation_id: ConvId,
    _path: String,
) -> ChatResult<MediaUploadView> {
    Err(ChatError::Unimplemented)
}

pub async fn report(
    _state: &ChatState,
    _conversation_id: ConvId,
    _media_id: Uuid,
    _reason: ReportReason,
    _comment: Option<String>,
) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}
