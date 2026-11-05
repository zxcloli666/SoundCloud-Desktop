use std::sync::Arc;

use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::{ChatError, ChatResult, ConvId};
use uuid::Uuid;

use super::engine::Downloads;
use super::{Fetched, Part};

impl Downloads {
    pub async fn original(
        self: &Arc<Self>,
        conversation_id: ConvId,
        media_id: Uuid,
        attachment: Option<Attachment>,
    ) -> ChatResult<Vec<u8>> {
        let missing = || ChatError::MediaMissing {
            ids: vec![media_id],
        };
        let attachment = attachment.ok_or_else(missing)?;
        match self
            .fetch(conversation_id, media_id, attachment, Part::Image)
            .await?
        {
            Fetched::Image(picture) => Ok(picture.bytes),
            Fetched::Deleted | Fetched::Lost => Err(missing()),
        }
    }
}
