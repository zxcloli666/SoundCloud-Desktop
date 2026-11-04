use sc_chat::{ChatError, ChatResult, ConvId, MediaUploadView};
use uuid::Uuid;

use super::state::ChatState;

pub async fn enqueue(
    _state: &ChatState,
    _conversation_id: ConvId,
    _paths: Vec<String>,
) -> ChatResult<Vec<MediaUploadView>> {
    Err(ChatError::Unimplemented)
}

pub async fn retry(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}

pub async fn cancel(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}
