use sc_chat::ChatResult;
use uuid::Uuid;

use super::album::repark_in;
use super::engine::Uploads;

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
                let Some(upload) = store.remove_upload(id)? else {
                    return Ok((Vec::new(), Vec::new()));
                };
                let released = repark_in(store, upload.album, upload.conversation_id, now)?;
                Ok((vec![upload], released))
            })
            .await?;
        drop(albums);
        self.dropped(removed).await;
        self.finish(released).await;
        self.kick();
        Ok(())
    }
}
