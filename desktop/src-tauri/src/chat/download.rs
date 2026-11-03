use sc_chat::{ChatError, ChatResult, ConvId};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::state::ChatState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Variant {
    Thumb,
    Image,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MediaKey {
    pub conversation_id: ConvId,
    pub media_id: Uuid,
    pub variant: Variant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fetched {
    Bytes(Vec<u8>),
    Deleted,
    Lost,
}

pub async fn load(_state: &ChatState, _key: &MediaKey) -> ChatResult<Fetched> {
    Err(ChatError::Unimplemented)
}
