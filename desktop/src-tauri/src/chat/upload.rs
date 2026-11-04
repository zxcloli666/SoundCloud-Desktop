use sc_chat::{ChatError, ChatResult, ConvId, MediaUploadView, Message, SendInput};
use uuid::Uuid;

use super::state::ChatState;

pub async fn enqueue(
    _state: &ChatState,
    _conversation_id: ConvId,
    _album: Option<Uuid>,
    _paths: Vec<String>,
) -> ChatResult<Vec<MediaUploadView>> {
    Err(ChatError::Unimplemented)
}

pub async fn enqueue_data(
    _state: &ChatState,
    _conversation_id: ConvId,
    _album: Option<Uuid>,
    _data: Vec<u8>,
) -> ChatResult<Vec<MediaUploadView>> {
    Err(ChatError::Unimplemented)
}

pub async fn send_album(
    _state: &ChatState,
    _input: SendInput,
    _album: Uuid,
) -> ChatResult<Message> {
    Err(ChatError::Unimplemented)
}

pub async fn cancel_album(_state: &ChatState, _album: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}

pub async fn avatar(
    _state: &ChatState,
    _conversation_id: ConvId,
    _path: String,
) -> ChatResult<MediaUploadView> {
    Err(ChatError::Unimplemented)
}

pub async fn retry(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}

pub async fn cancel(_state: &ChatState, _id: Uuid) -> ChatResult<()> {
    Err(ChatError::Unimplemented)
}
