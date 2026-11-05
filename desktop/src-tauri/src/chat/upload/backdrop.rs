use std::future::Future;
use std::sync::Arc;

use sc_chat::api::wire::FileBackdropReport;
use sc_chat::media::{self, PreparedBackdrop};
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{
    BackdropChange, BackdropReport, ChatError, ChatResult, ConvId, ConversationKind, MediaKind,
    MediaUploadView, Millis, ReportReason, RoomBackdrop, RoomSettingsPatch,
};
use uuid::Uuid;

use super::engine::Uploads;
use super::single::{Single, queue_meta, remove_pending};

impl Uploads {
    pub async fn backdrop(
        &self,
        code: &str,
        room: ConvId,
        original: impl Future<Output = ChatResult<Vec<u8>>>,
    ) -> ChatResult<Option<MediaUploadView>> {
        self.room_of(code, room).await?;
        let turn = self.turns.take(room);
        let prepared = tokio::select! {
            biased;
            () = self.turns.passed(room, turn) => return Ok(None),
            prepared = self.prepared_backdrop(original) => prepared?,
        };
        self.enqueue_single(Single {
            conversation_id: room,
            kind: MediaKind::Backdrop,
            image: prepared.image,
            attachment: prepared.attachment,
            turn: Some(turn),
        })
        .await
    }

    pub async fn stop_backdrop(&self, room: ConvId) -> ChatResult<()> {
        self.turns.take(room);
        let albums = self.albums.lock().await;
        let removed = self
            .blocking(move |store| remove_pending(store, room, MediaKind::Backdrop))
            .await?;
        drop(albums);
        self.dropped(removed).await;
        Ok(())
    }

    pub async fn set_backdrop(
        &self,
        code: &str,
        room: ConvId,
        preset: Option<String>,
    ) -> ChatResult<()> {
        self.room_of(code, room).await?;
        self.turns.take(room);
        let albums = self.albums.lock().await;
        let removed = self
            .blocking(move |store| remove_pending(store, room, MediaKind::Backdrop))
            .await?;
        let patch = RoomSettingsPatch {
            backdrop: Some(preset.map(|id| RoomBackdrop::Preset { id })),
            ..RoomSettingsPatch::default()
        };
        let set = self.api.room_settings(code, &patch).await;
        let now = self.now();
        let cleared = match set {
            Ok(_) => {
                self.blocking(move |store| clear_backdrop(store, room, now))
                    .await
            }
            Err(error) => Err(error),
        };
        drop(albums);
        self.dropped(removed).await;
        if cleared? {
            self.host.sent();
        }
        Ok(())
    }

    pub async fn report_backdrop(
        &self,
        room: ConvId,
        media_id: Uuid,
        reason: ReportReason,
        comment: Option<String>,
    ) -> ChatResult<()> {
        let report = BackdropReport {
            conversation_id: room,
            media_id,
            reason,
            comment: comment.filter(|comment| !comment.trim().is_empty()),
        };
        self.api
            .report_backdrop(&FileBackdropReport::from(&report))
            .await?;
        Ok(())
    }

    pub(super) async fn backdrop_committed(&self, upload: &MediaUpload) {
        let applied = self.apply_backdrop(upload).await;
        self.applied(upload, applied).await;
    }

    async fn apply_backdrop(&self, upload: &MediaUpload) -> ChatResult<Vec<MediaUpload>> {
        let (id, album, room) = (upload.id, upload.album, upload.conversation_id);
        let media_id = upload.media_id.ok_or(ChatError::Invalid)?;
        let code = self.room_code(room).await?;
        let _albums = self.albums.lock().await;
        if self
            .blocking(move |store| store.upload(id))
            .await?
            .is_none()
        {
            return Ok(Vec::new());
        }
        let patch = RoomSettingsPatch {
            backdrop: Some(Some(RoomBackdrop::Image { media_id })),
            ..RoomSettingsPatch::default()
        };
        self.api.room_settings(&code, &patch).await?;
        let now = self.now();
        self.blocking(move |store| {
            let meta = store.backdrop_meta(room, &BackdropChange::Set { upload_id: id })?;
            queue_meta(store, room, album, meta, now)?;
            store.remove_album_uploads(album)
        })
        .await
    }

    async fn prepared_backdrop(
        &self,
        original: impl Future<Output = ChatResult<Vec<u8>>>,
    ) -> ChatResult<PreparedBackdrop> {
        let bytes = original.await?;
        self.prepare
            .run(move || media::prepare_backdrop(&bytes))
            .await
    }

    async fn room_of(&self, code: &str, room: ConvId) -> ChatResult<()> {
        match self.room_code(room).await? == code {
            true => Ok(()),
            false => Err(ChatError::Invalid),
        }
    }

    async fn room_code(&self, room: ConvId) -> ChatResult<String> {
        self.blocking(move |store| {
            let summary = store.conversation(room)?.ok_or(ChatError::NotFound)?;
            match (summary.kind, summary.room_code) {
                (ConversationKind::Room, Some(code)) => Ok(code),
                _ => Err(ChatError::Invalid),
            }
        })
        .await
    }
}

fn clear_backdrop(store: &Arc<Store>, room: ConvId, now: Millis) -> ChatResult<bool> {
    if store.room_backdrop(room)?.is_none() {
        return Ok(false);
    }
    let meta = store.backdrop_meta(room, &BackdropChange::Clear)?;
    queue_meta(store, room, Uuid::new_v4(), meta, now)?;
    Ok(true)
}
