use sc_chat::store::Store;
use sc_chat::{ChatError, ChatResult, ConvId};
use serde::Deserialize;
use uuid::Uuid;

pub const KNOWN_MAX: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRef {
    pub conversation_id: ConvId,
    pub media_id: Uuid,
}

pub fn keyed(store: &Store, media: &[MediaRef]) -> ChatResult<Vec<Uuid>> {
    if media.len() > KNOWN_MAX {
        return Err(ChatError::Invalid);
    }
    Ok(media
        .iter()
        .filter(|item| {
            matches!(
                store.attachment(item.conversation_id, item.media_id),
                Ok(Some(_))
            )
        })
        .map(|item| item.media_id)
        .collect())
}
