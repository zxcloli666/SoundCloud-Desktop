use std::path::PathBuf;

use sc_chat::media::{self, PreparedAvatar};
use sc_chat::store::MediaUpload;
use sc_chat::{
    AvatarChange, ChatError, ChatResult, ConvId, ConversationKind, ConversationPatch, MediaKind,
    MediaUploadView,
};

use super::engine::Uploads;
use super::prepare::read_source;
use super::single::{Single, queue_meta};

impl Uploads {
    pub async fn avatar(
        &self,
        conversation_id: ConvId,
        path: PathBuf,
    ) -> ChatResult<MediaUploadView> {
        if self.kind_of(conversation_id).await? != ConversationKind::Group {
            return Err(ChatError::Invalid);
        }
        let bytes = read_source(&path).await?;
        let prepared: PreparedAvatar = self
            .prepare
            .run(move || media::prepare_avatar(&bytes))
            .await?;
        self.enqueue_single(Single {
            conversation_id,
            kind: MediaKind::Avatar,
            image: prepared.image,
            attachment: prepared.attachment,
            turn: None,
        })
        .await?
        .ok_or(ChatError::Internal)
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
                queue_meta(store, conversation_id, album, meta, now)?;
                store.remove_album_uploads(album)
            })
            .await;
        drop(albums);
        self.applied(upload, applied).await;
    }
}
