use std::path::PathBuf;

use sc_chat::envelope::{self, Content};
use sc_chat::media::{self, PreparedAvatar};
use sc_chat::outbox::{Outbox, OutboxItem};
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::store::{MediaUpload, NewUpload};
use sc_chat::{
    AvatarChange, ChatError, ChatResult, ConvId, ConversationKind, ConversationPatch, MediaKind,
    MediaUploadView,
};
use uuid::Uuid;

use super::driver::file_names;
use super::engine::Uploads;
use super::files::IMAGE;
use super::prepare::read_source;

impl Uploads {
    pub async fn avatar(
        &self,
        conversation_id: ConvId,
        path: PathBuf,
    ) -> ChatResult<MediaUploadView> {
        let kind = self
            .blocking(move |store| {
                Ok(store
                    .conversation(conversation_id)?
                    .ok_or(ChatError::NotFound)?
                    .kind)
            })
            .await?;
        if kind != ConversationKind::Group {
            return Err(ChatError::Invalid);
        }
        let bytes = read_source(&path).await?;
        let prepared: PreparedAvatar = self
            .prepare
            .run(move || media::prepare_avatar(&bytes))
            .await?;
        self.drop_avatars(conversation_id).await?;
        let image_ref = self.files.write(IMAGE, &prepared.image).await?;
        let upload = NewUpload {
            album: Uuid::new_v4(),
            position: 0,
            conversation_id,
            kind: MediaKind::Avatar,
            image_ref: image_ref.clone(),
            thumb_ref: None,
            attachment: prepared.attachment,
        };
        let view = self.enqueued(upload, vec![image_ref]).await?;
        self.kick();
        Ok(view)
    }

    async fn drop_avatars(&self, conversation_id: ConvId) -> ChatResult<()> {
        let _albums = self.albums.lock().await;
        let removed = self
            .blocking(move |store| {
                let mut removed = Vec::new();
                for upload in store.uploads()? {
                    if upload.kind == MediaKind::Avatar && upload.conversation_id == conversation_id
                    {
                        removed.extend(store.remove_album_uploads(upload.album)?);
                    }
                }
                Ok(removed)
            })
            .await?;
        drop(_albums);
        self.dropped(removed).await;
        Ok(())
    }

    pub(super) async fn avatar_committed(&self, upload: &MediaUpload) {
        let (id, album, conversation_id) = (upload.id, upload.album, upload.conversation_id);
        let now = self.now();
        let albums = self.albums.lock().await;
        let applied = self
            .blocking(move |store| {
                let patch = ConversationPatch {
                    meta: None,
                    me: None,
                    avatar: Some(AvatarChange::Set { upload_id: id }),
                };
                let meta = store.next_meta(conversation_id, &patch)?;
                let content = Content::Meta(meta);
                let envelope = envelope::encode(&content)?.encode_to_vec();
                Outbox::new(store.clone()).push(OutboxItem {
                    client_id: album,
                    conversation_id,
                    class: content.class(),
                    target_seq: None,
                    envelope,
                    created_at: now,
                    attempts: 0,
                    next_at: now,
                })?;
                store.remove_album_uploads(album)
            })
            .await;
        drop(albums);
        match applied {
            Ok(removed) => {
                self.files
                    .remove(removed.iter().flat_map(file_names).collect())
                    .await;
                self.host.sent();
            }
            Err(ChatError::Store | ChatError::NotReady | ChatError::Internal) => {}
            Err(error) => {
                self.host.failed(id, &error);
                if let Ok(removed) = self
                    .blocking(move |store| store.remove_album_uploads(album))
                    .await
                {
                    self.dropped(removed).await;
                }
            }
        }
    }
}
