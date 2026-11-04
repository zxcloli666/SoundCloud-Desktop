use std::path::PathBuf;

use sc_chat::media::{self, PreparedImage};
use sc_chat::store::NewUpload;
use sc_chat::{ChatError, ChatResult, ConvId, ConversationKind, MediaKind, MediaUploadView};
use uuid::Uuid;

use super::engine::Uploads;
use super::files::{IMAGE, THUMB};
use super::prepare::{checked_source, read_source};

pub enum Source {
    Path(PathBuf),
    Data(Vec<u8>),
}

struct Slot {
    album: Uuid,
    position: u32,
    left: usize,
}

impl Uploads {
    pub async fn attach(
        &self,
        conversation_id: ConvId,
        album: Option<Uuid>,
        sources: Vec<Source>,
    ) -> ChatResult<Vec<MediaUploadView>> {
        if sources.is_empty() {
            return Err(ChatError::Invalid);
        }
        let _albums = self.albums.lock().await;
        let mut slot = self.slot(conversation_id, album).await?;
        let mut accepted = Vec::new();
        let mut refused = None;
        for source in sources {
            if accepted.len() >= slot.left {
                refused.get_or_insert(ChatError::Invalid);
                break;
            }
            match self.add_image(conversation_id, &slot, source).await {
                Ok(view) => {
                    accepted.push(view);
                    slot.position += 1;
                }
                Err(error) => {
                    refused.get_or_insert(error);
                }
            }
        }
        if accepted.is_empty() {
            return Err(refused.unwrap_or(ChatError::Invalid));
        }
        self.kick();
        Ok(accepted)
    }

    async fn slot(&self, conversation_id: ConvId, album: Option<Uuid>) -> ChatResult<Slot> {
        let album = album.unwrap_or_else(Uuid::new_v4);
        let (room, taken, position) = self
            .blocking(move |store| {
                let summary = store
                    .conversation(conversation_id)?
                    .ok_or(ChatError::NotFound)?;
                let uploads = store.album_uploads(album)?;
                let foreign = uploads.iter().any(|upload| {
                    upload.conversation_id != conversation_id || upload.kind != MediaKind::Image
                });
                if foreign {
                    return Err(ChatError::Invalid);
                }
                let position = uploads.iter().map(|upload| upload.position + 1).max();
                Ok((
                    summary.kind == ConversationKind::Room,
                    uploads.len(),
                    position.unwrap_or(0),
                ))
            })
            .await?;
        Ok(Slot {
            album,
            position,
            left: self.host.album_max(room).saturating_sub(taken),
        })
    }

    async fn add_image(
        &self,
        conversation_id: ConvId,
        slot: &Slot,
        source: Source,
    ) -> ChatResult<MediaUploadView> {
        let bytes = match source {
            Source::Path(path) => read_source(&path).await?,
            Source::Data(data) => checked_source(data)?,
        };
        let prepared: PreparedImage = self
            .prepare
            .run(move || media::prepare_image(&bytes))
            .await?;
        let image_ref = self.files.write(IMAGE, &prepared.image).await?;
        let thumb_ref = match self.files.write(THUMB, &prepared.thumb).await {
            Ok(name) => name,
            Err(error) => {
                self.files.remove(vec![image_ref]).await;
                return Err(error);
            }
        };
        let upload = NewUpload {
            album: slot.album,
            position: slot.position,
            conversation_id,
            kind: MediaKind::Image,
            image_ref: image_ref.clone(),
            thumb_ref: Some(thumb_ref.clone()),
            attachment: prepared.attachment,
        };
        self.enqueued(upload, vec![image_ref, thumb_ref]).await
    }

    pub(super) async fn enqueued(
        &self,
        upload: NewUpload,
        files: Vec<String>,
    ) -> ChatResult<MediaUploadView> {
        let now = self.now();
        let stored = self
            .blocking(move |store| {
                let id = store.enqueue_upload(&upload, now)?;
                store.upload(id)?.ok_or(ChatError::Store)
            })
            .await;
        match stored {
            Ok(upload) => Ok(MediaUploadView::from(&upload)),
            Err(error) => {
                self.files.remove(files).await;
                Err(error)
            }
        }
    }
}
