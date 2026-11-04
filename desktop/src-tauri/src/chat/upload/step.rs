use bytes::Bytes;
use sc_chat::media::queue::{self, PutTargets};
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, MediaKind, UploadObject, UploadState};

use super::engine::Uploads;
use super::errors::Snag;
use super::put::Object;

impl Uploads {
    pub(super) async fn step(&self, upload: MediaUpload) -> Result<(), Snag> {
        match upload.state {
            UploadState::Uploaded => self.commit(upload).await,
            UploadState::Committed | UploadState::Failed => Ok(()),
            _ => self.send_object(upload).await,
        }
    }

    async fn send_object(&self, upload: MediaUpload) -> Result<(), Snag> {
        let targets = self.targets(&upload).await?;
        let id = upload.id;
        let upload = self
            .blocking(move |store| store.upload(id))
            .await?
            .ok_or(ChatError::NotFound)?;
        let (name, size, target) = match upload.object {
            UploadObject::Image => (
                Some(upload.image_ref.clone()),
                upload.attachment.size,
                Some(targets.image.clone()),
            ),
            UploadObject::Thumb => (
                upload.thumb_ref.clone(),
                upload
                    .attachment
                    .thumb
                    .as_ref()
                    .map_or(0, |thumb| thumb.size),
                targets.thumb.clone(),
            ),
        };
        let (Some(name), Some(target)) = (name, target) else {
            return Err(Snag::Failed(ChatError::Invalid));
        };
        let body = self.files.read(&name, size).await?;
        let object = upload.object;
        self.put(Object {
            upload: &upload,
            object,
            target,
            expires_at: targets.expires_at,
            body: Bytes::from(body),
        })
        .await
        .inspect_err(|snag| {
            if *snag == Snag::Expired {
                self.forget_targets(id);
            }
        })?;
        let now = self.now();
        self.blocking(move |store| store.upload_object_done(id, object, now))
            .await?;
        Ok(())
    }

    pub(super) async fn targets(&self, upload: &MediaUpload) -> Result<PutTargets, Snag> {
        let now = self.now();
        let cached = self
            .targets
            .lock()
            .ok()
            .and_then(|targets| targets.get(&upload.id).cloned())
            .filter(|targets| {
                !upload.presign_expired(now)
                    && upload.presign_expires_at == Some(targets.expires_at)
                    && upload.media_id.is_some()
            });
        if let Some(targets) = cached {
            return Ok(targets);
        }
        let store = self.store()?;
        let targets = queue::reserve(&self.api, &store, upload.id, now).await?;
        if let Ok(mut cache) = self.targets.lock() {
            cache.insert(upload.id, targets.clone());
        }
        Ok(targets)
    }

    async fn commit(&self, upload: MediaUpload) -> Result<(), Snag> {
        let store = self.store()?;
        let now = self.now();
        match queue::commit(&self.api, &store, upload.id, now).await {
            Ok(_) => {
                self.forget_targets(upload.id);
                self.committed(&upload).await;
                Ok(())
            }
            Err(ChatError::MediaMissing { .. } | ChatError::NotFound) => {
                self.forget_targets(upload.id);
                Err(Snag::Missing)
            }
            Err(error) => Err(Snag::Failed(error)),
        }
    }

    pub(super) async fn committed(&self, upload: &MediaUpload) {
        match upload.kind {
            MediaKind::Image => self.release(upload.album).await,
            MediaKind::Avatar => self.avatar_committed(upload).await,
            MediaKind::Backdrop => self.backdrop_committed(upload).await,
        }
    }
}
