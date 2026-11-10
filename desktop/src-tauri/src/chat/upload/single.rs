use std::sync::Arc;

use sc_chat::envelope::{self, Content};
use sc_chat::outbox::{Outbox, OutboxItem};
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::store::{MediaUpload, NewUpload, Store};
use sc_chat::{
    ChatError, ChatResult, ConvId, ConversationKind, ConversationMeta, MediaKind, MediaUploadView,
    Millis,
};
use uuid::Uuid;

use super::driver::file_names;
use super::engine::Uploads;
use super::files::IMAGE;

pub struct Single {
    pub conversation_id: ConvId,
    pub kind: MediaKind,
    pub image: Vec<u8>,
    pub attachment: Attachment,
    pub turn: Option<u64>,
}

impl Uploads {
    pub(super) async fn kind_of(&self, conversation_id: ConvId) -> ChatResult<ConversationKind> {
        self.blocking(move |store| {
            Ok(store
                .conversation(conversation_id)?
                .ok_or(ChatError::NotFound)?
                .kind)
        })
        .await
    }

    pub(super) async fn enqueue_single(
        &self,
        single: Single,
    ) -> ChatResult<Option<MediaUploadView>> {
        let (conversation_id, kind) = (single.conversation_id, single.kind);
        let image_ref = self.files.write(IMAGE, &single.image).await?;
        let upload = NewUpload {
            album: Uuid::new_v4(),
            position: 0,
            conversation_id,
            kind,
            image_ref: image_ref.clone(),
            thumb_ref: None,
            attachment: single.attachment,
        };
        let albums = self.albums.lock().await;
        if !self.wanted(conversation_id, single.turn) {
            drop(albums);
            self.files.remove(vec![image_ref]).await;
            return Ok(None);
        }
        let replaced = match self
            .blocking(move |store| remove_pending(store, conversation_id, kind))
            .await
        {
            Ok(replaced) => replaced,
            Err(error) => {
                drop(albums);
                self.files.remove(vec![image_ref]).await;
                return Err(error);
            }
        };
        let view = self.enqueued(upload, vec![image_ref]).await;
        drop(albums);
        self.dropped(replaced).await;
        let view = view?;
        self.kick();
        Ok(Some(view))
    }

    fn wanted(&self, conversation_id: ConvId, turn: Option<u64>) -> bool {
        turn.is_none_or(|turn| self.turns.holds(conversation_id, turn))
    }

    pub(super) async fn applied(
        &self,
        upload: &MediaUpload,
        outcome: ChatResult<Vec<MediaUpload>>,
    ) {
        match outcome {
            Ok(removed) => {
                self.seed_cache(&removed).await;
                self.files
                    .remove(removed.iter().flat_map(file_names).collect())
                    .await;
                self.host.sent();
            }
            Err(error) if later(&error) => {}
            Err(error) => {
                self.host.failed(upload.id, &error);
                let album = upload.album;
                if let Ok(removed) = self
                    .blocking(move |store| store.remove_album_uploads(album))
                    .await
                {
                    self.discard(removed).await;
                }
            }
        }
    }
}

pub fn remove_pending(
    store: &Arc<Store>,
    conversation_id: ConvId,
    kind: MediaKind,
) -> ChatResult<Vec<MediaUpload>> {
    let mut removed = Vec::new();
    for upload in store.uploads()? {
        if upload.kind == kind && upload.conversation_id == conversation_id {
            removed.extend(store.remove_album_uploads(upload.album)?);
        }
    }
    Ok(removed)
}

pub fn queue_meta(
    store: &Arc<Store>,
    conversation_id: ConvId,
    client_id: Uuid,
    meta: ConversationMeta,
    now: Millis,
) -> ChatResult<()> {
    let content = Content::Meta(Box::new(meta));
    let envelope = envelope::encode(&content)?.encode_to_vec();
    Outbox::new(store.clone()).push(OutboxItem {
        client_id,
        conversation_id,
        class: content.class(),
        target_seq: None,
        envelope,
        created_at: now,
        attempts: 0,
        next_at: now,
    })?;
    Ok(())
}

pub fn later(error: &ChatError) -> bool {
    matches!(
        error,
        ChatError::Store
            | ChatError::NotReady
            | ChatError::Internal
            | ChatError::Offline
            | ChatError::Busy { .. }
            | ChatError::RequestLimit
            | ChatError::DeviceRevoked
            | ChatError::ReloginRequired
    )
}
