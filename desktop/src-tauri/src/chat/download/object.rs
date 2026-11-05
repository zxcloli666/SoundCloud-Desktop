use std::sync::Arc;

use sc_chat::ConvId;
use sc_chat::media::{IMAGE_CAP, THUMB_SERVER_CAP};
use sc_chat::sc_chat_wire::proto::Attachment;
use uuid::Uuid;

use super::Part;
use super::get::{Expect, Seal};

pub struct Object {
    pub conversation_id: ConvId,
    pub media_id: Uuid,
    pub remote_id: Uuid,
    pub part: Part,
    pub attachment: Attachment,
}

impl Object {
    pub fn of(conversation_id: ConvId, attachment: Attachment, part: Part) -> Option<Self> {
        let media_id = Uuid::parse_str(&attachment.media_id).ok()?;
        let thumb = attachment
            .thumb
            .as_ref()
            .and_then(|thumb| Uuid::parse_str(&thumb.media_id).ok());
        let (part, remote_id) = match (part, thumb) {
            (Part::Thumb, Some(thumb)) => (Part::Thumb, thumb),
            _ => (Part::Image, media_id),
        };
        Some(Self {
            conversation_id,
            media_id,
            remote_id,
            part,
            attachment,
        })
    }

    pub fn expect(&self) -> Arc<Expect> {
        let expect = match (self.part, &self.attachment.thumb) {
            (Part::Thumb, Some(thumb)) => Expect {
                size: thumb.size,
                cap: THUMB_SERVER_CAP,
                sha256: Vec::new(),
                seal: Some(Seal {
                    key: thumb.key.clone(),
                    nonce: thumb.nonce.clone(),
                }),
            },
            _ => Expect {
                size: self.attachment.size,
                cap: IMAGE_CAP,
                sha256: self.attachment.sha256_cipher.clone(),
                seal: None,
            },
        };
        Arc::new(expect)
    }
}
