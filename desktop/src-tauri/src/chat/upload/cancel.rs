use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use super::engine::Uploads;
use super::post::{Posted, Released, posted, repark_in};

impl Uploads {
    pub async fn retry(&self, id: Uuid) -> ChatResult<()> {
        let now = self.now();
        self.blocking(move |store| store.upload_restart(id, now))
            .await?;
        self.forget_targets(id);
        self.wake_all();
        Ok(())
    }

    pub async fn cancel(&self, id: Uuid) -> ChatResult<()> {
        let albums = self.albums.lock().await;
        let now = self.now();
        let (removed, released) = self
            .blocking(move |store| {
                let Some(upload) = store.upload(id)? else {
                    return Ok((Vec::new(), Released::Waiting));
                };
                let (album, conversation_id) = (upload.album, upload.conversation_id);
                let uploads = store.album_uploads(album)?;
                let parked = match posted(store, conversation_id, album, &uploads)? {
                    Posted::None => None,
                    Posted::Parked(message) => Some(message),
                    Posted::Stale(_) | Posted::Sending(_) => return Err(ChatError::Invalid),
                };
                let removed: Vec<_> = store.remove_upload(id)?.into_iter().collect();
                let released = match parked {
                    Some(message) => repark_in(store, album, conversation_id, message, now)?,
                    None => Released::Waiting,
                };
                Ok((removed, released))
            })
            .await?;
        drop(albums);
        self.dropped(removed).await;
        self.released(released).await;
        self.kick();
        Ok(())
    }
}
