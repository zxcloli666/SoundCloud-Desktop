use std::path::PathBuf;

use sc_chat::media::{self, PreparedImage};
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::store::NewUpload;
use sc_chat::{ChatError, ChatResult, ConvId, ConversationKind, MediaKind, MediaUploadView};
use uuid::Uuid;

use super::album::repark_in;
use super::engine::Uploads;
use super::files::{IMAGE, THUMB};
use super::prepare::{checked_source, read_source};
use crate::app::diagnostics;

pub enum Source {
    Path(PathBuf),
    Data(Vec<u8>),
}

struct Slot {
    album: Uuid,
    position: u32,
    left: usize,
}

struct Sealed {
    image_ref: String,
    thumb_ref: String,
    attachment: Attachment,
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
        let album = album.unwrap_or_else(Uuid::new_v4);
        let left = self.slot(conversation_id, album).await?.left;
        let mut refused = (sources.len() > left).then_some(ChatError::Invalid);
        let mut sealed = Vec::new();
        for source in sources.into_iter().take(left) {
            match self.seal(source).await {
                Ok(image) => sealed.push(image),
                Err(error) => {
                    refused.get_or_insert(error);
                }
            }
        }
        let accepted = self
            .place(conversation_id, album, sealed, &mut refused)
            .await;
        if accepted.is_empty() {
            return Err(refused.unwrap_or(ChatError::Invalid));
        }
        self.kick();
        Ok(accepted)
    }

    async fn place(
        &self,
        conversation_id: ConvId,
        album: Uuid,
        sealed: Vec<Sealed>,
        refused: &mut Option<ChatError>,
    ) -> Vec<MediaUploadView> {
        let _albums = self.albums.lock().await;
        let mut slot = match self.slot(conversation_id, album).await {
            Ok(slot) => slot,
            Err(error) => {
                refused.get_or_insert(error);
                Slot {
                    album,
                    position: 0,
                    left: 0,
                }
            }
        };
        let mut accepted = Vec::new();
        for image in sealed {
            let files = vec![image.image_ref.clone(), image.thumb_ref.clone()];
            if accepted.len() >= slot.left {
                refused.get_or_insert(ChatError::Invalid);
                self.files.remove(files).await;
                continue;
            }
            match self
                .enqueued(new_upload(conversation_id, &slot, image), files)
                .await
            {
                Ok(view) => {
                    accepted.push(view);
                    slot.position += 1;
                }
                Err(error) => {
                    refused.get_or_insert(error);
                }
            }
        }
        if !accepted.is_empty() {
            let now = self.now();
            let reparked = self
                .blocking(move |store| repark_in(store, album, conversation_id, now))
                .await;
            if let Err(error) = reparked {
                diagnostics::warn(format!("[ChatUpload] repark after attach: {error}"));
            }
        }
        accepted
    }

    async fn slot(&self, conversation_id: ConvId, album: Uuid) -> ChatResult<Slot> {
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

    async fn seal(&self, source: Source) -> ChatResult<Sealed> {
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
        Ok(Sealed {
            image_ref,
            thumb_ref,
            attachment: prepared.attachment,
        })
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

fn new_upload(conversation_id: ConvId, slot: &Slot, image: Sealed) -> NewUpload {
    NewUpload {
        album: slot.album,
        position: slot.position,
        conversation_id,
        kind: MediaKind::Image,
        image_ref: image.image_ref,
        thumb_ref: Some(image.thumb_ref),
        attachment: image.attachment,
    }
}
