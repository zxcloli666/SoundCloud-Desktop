use std::sync::Arc;
use std::time::Duration;

use sc_chat::store::Store;
use sc_chat::{ChatResult, MediaKind};
use uuid::Uuid;

use super::engine::Uploads;
use super::post::{pending_post, ready};
use super::schedule::grouped;

const DELETE_WAIT: Duration = Duration::from_secs(5);

impl Uploads {
    pub async fn halt(&self) {
        let Some(store) = self.host.store() else {
            return;
        };
        if let Ok(mut halted) = self.halted.lock() {
            *halted = Arc::downgrade(&store);
        }
        self.stop.notify_waiters();
        if let Ok(mut targets) = self.targets.lock() {
            targets.clear();
        }
        let found = tokio::task::spawn_blocking(move || orphans(&store)).await;
        let slot = self.delete_slot().await;
        if let Ok(Ok(media)) = found {
            self.queue_deletes(&slot, media).await;
        }
        let _ = tokio::time::timeout(DELETE_WAIT, self.flush_deletes(&slot)).await;
    }
}

fn orphans(store: &Arc<Store>) -> ChatResult<Vec<Uuid>> {
    let mut media = Vec::new();
    for album in grouped(store.uploads()?) {
        let first = &album[0];
        let delivered = first.kind == MediaKind::Image
            && ready(&album)
            && pending_post(store, first.conversation_id, first.album)?.is_none();
        if !delivered {
            media.extend(album.iter().filter_map(|upload| upload.media_id));
        }
    }
    Ok(media)
}
