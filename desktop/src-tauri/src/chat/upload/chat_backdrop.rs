use std::future::Future;
use std::sync::Arc;

use sc_chat::media::BackdropStep;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{
    BackdropChange, ChatError, ChatResult, ConvId, ConversationKind, MediaKind, MediaUploadView,
};
use uuid::Uuid;

use super::engine::Uploads;
use super::single::{Single, queue_meta, remove_pending};

impl Uploads {
    pub async fn chat_backdrop(
        &self,
        conversation_id: ConvId,
        original: impl Future<Output = ChatResult<Vec<u8>>>,
    ) -> ChatResult<Option<MediaUploadView>> {
        self.plain_chat(conversation_id).await?;
        let turn = self.turns.take(conversation_id);
        let prepared = tokio::select! {
            biased;
            () = self.turns.passed(conversation_id, turn) => return Ok(None),
            prepared = self.prepared_backdrop(original) => prepared?,
        };
        self.enqueue_single(Single {
            conversation_id,
            kind: MediaKind::Backdrop,
            image: prepared.image,
            attachment: prepared.attachment,
            turn: Some(turn),
        })
        .await
    }

    pub async fn set_chat_backdrop(
        &self,
        conversation_id: ConvId,
        preset: Option<String>,
    ) -> ChatResult<()> {
        self.plain_chat(conversation_id).await?;
        self.turns.take(conversation_id);
        let albums = self.albums.lock().await;
        let removed = self
            .blocking(move |store| remove_pending(store, conversation_id, MediaKind::Backdrop))
            .await?;
        let step = self
            .blocking(move |store| chat_step(store, conversation_id, preset))
            .await;
        let sent = match step {
            Ok(step) => step.send(&self.api).await,
            Err(error) => Err(error),
        };
        let now = self.now();
        let queued = match sent {
            Ok(Some(meta)) => {
                self.blocking(move |store| {
                    queue_meta(store, conversation_id, Uuid::new_v4(), meta, now)
                })
                .await
            }
            Ok(None) => Ok(()),
            Err(error) => Err(error),
        };
        drop(albums);
        self.dropped(removed).await;
        queued?;
        self.host.sent();
        Ok(())
    }

    pub(super) async fn chat_backdrop_committed(
        &self,
        upload: &MediaUpload,
    ) -> ChatResult<Vec<MediaUpload>> {
        let (id, album, conversation_id) = (upload.id, upload.album, upload.conversation_id);
        let _albums = self.albums.lock().await;
        let step = self
            .blocking(move |store| match store.upload(id)? {
                Some(_) => BackdropStep::set(
                    store,
                    conversation_id,
                    &BackdropChange::Set { upload_id: id },
                )
                .map(Some),
                None => Ok(None),
            })
            .await?;
        let Some(step) = step else {
            return Ok(Vec::new());
        };
        let meta = step.send(&self.api).await?;
        let now = self.now();
        self.blocking(move |store| {
            if let Some(meta) = meta {
                queue_meta(store, conversation_id, album, meta, now)?;
            }
            store.remove_album_uploads(album)
        })
        .await
    }

    async fn plain_chat(&self, conversation_id: ConvId) -> ChatResult<()> {
        match self.kind_of(conversation_id).await? {
            ConversationKind::Room | ConversationKind::Unknown => Err(ChatError::Invalid),
            _ => Ok(()),
        }
    }
}

fn chat_step(store: &Arc<Store>, id: ConvId, preset: Option<String>) -> ChatResult<BackdropStep> {
    match preset {
        Some(preset) => BackdropStep::preset(store, id, preset),
        None => BackdropStep::set(store, id, &BackdropChange::Clear),
    }
}
