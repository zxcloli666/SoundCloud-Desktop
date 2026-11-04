use std::sync::Arc;

use sc_chat::store::{MediaUpload, Store};
use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use super::album::repark_in;
use super::engine::Uploads;

impl Uploads {
    pub async fn retry(&self, id: Uuid) -> ChatResult<()> {
        let now = self.now();
        self.blocking(move |store| store.upload_restart(id, now))
            .await?;
        self.forget_targets(id);
        self.kick();
        Ok(())
    }

    pub async fn cancel(&self, id: Uuid) -> ChatResult<()> {
        let albums = self.albums.lock().await;
        let now = self.now();
        let removed = self
            .blocking(move |store| {
                let Some(upload) = store.upload(id)? else {
                    return Ok((Vec::new(), Vec::new()));
                };
                let removed = remove_one(store, &upload)?;
                let released = repark_in(store, upload.album, upload.conversation_id, now)?;
                Ok((removed, released))
            })
            .await?;
        drop(albums);
        let (removed, released) = removed;
        self.dropped(removed).await;
        self.finish(released).await;
        self.kick();
        Ok(())
    }
}

fn remove_one(store: &Arc<Store>, upload: &MediaUpload) -> ChatResult<Vec<MediaUpload>> {
    let album = store.album_uploads(upload.album)?;
    if album.len() == 1 {
        return store.remove_album_uploads(upload.album);
    }
    Err(ChatError::Unimplemented)
}
