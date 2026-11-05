use std::sync::Arc;

use sc_chat::api::wire::MediaSelection;
use sc_chat::store::Store;
use sc_chat::{ChatResult, Millis};
use uuid::Uuid;

use super::delete_queue::Slot;
use super::engine::Uploads;
use super::single::later;
use crate::app::diagnostics;

pub const DELETE_CHUNK: usize = 500;

impl Uploads {
    pub(super) async fn delete_on_server(&self, media: Vec<Uuid>) {
        if media.is_empty() {
            return;
        }
        let slot = self.delete_slot().await;
        self.queue_deletes(&slot, media).await;
        self.flush_deletes(&slot).await;
    }

    pub(super) async fn queue_deletes(&self, slot: &Slot, media: Vec<Uuid>) {
        if media.is_empty() {
            return;
        }
        let queue = self.queue.clone();
        let slot = slot.clone();
        let queued = tokio::task::spawn_blocking(move || queue.add(&slot, &media)).await;
        if !matches!(queued, Ok(Ok(()))) {
            diagnostics::warn("[ChatUpload] could not keep a server delete on disk");
        }
    }

    pub(super) async fn retry_deletes(&self) {
        let slot = self.delete_slot().await;
        if let Slot::Account(account) = &slot {
            let queue = self.queue.clone();
            let account = account.clone();
            let _ = tokio::task::spawn_blocking(move || queue.adopt(&account)).await;
        }
        self.flush_deletes(&slot).await;
    }

    pub(super) async fn delete_slot(&self) -> Slot {
        let me = self.blocking(|store| store.me()).await;
        me.ok().flatten().map_or(Slot::Store, Slot::Account)
    }

    pub(super) async fn restart_rows(&self, ids: Vec<Uuid>) -> ChatResult<()> {
        let now = self.now();
        let dropped = self
            .blocking(move |store| {
                let mut dropped = Vec::new();
                for id in ids {
                    dropped.extend(restarted(store, id, now)?);
                }
                Ok(dropped)
            })
            .await?;
        self.delete_on_server(dropped).await;
        Ok(())
    }

    pub(super) async fn flush_deletes(&self, slot: &Slot) {
        if !self.speaks_for(slot) {
            return;
        }
        let _flushing = self.deletes.lock().await;
        let pending = self.pending_deletes(slot).await;
        for chunk in pending.chunks(DELETE_CHUNK) {
            if !self.speaks_for(slot) {
                return;
            }
            let chunk = chunk.to_vec();
            match self
                .api
                .delete_media(&MediaSelection::ids(chunk.clone()))
                .await
            {
                Ok(_) => self.settle_deletes(slot, chunk).await,
                Err(error) if later(&error) => return,
                Err(error) => {
                    diagnostics::warn(format!("[ChatUpload] server delete refused: {error}"));
                    self.settle_deletes(slot, chunk).await;
                }
            }
        }
    }

    fn speaks_for(&self, slot: &Slot) -> bool {
        match slot {
            Slot::Account(account) => self.host.account().as_ref() == Some(account),
            Slot::Store => false,
        }
    }

    async fn pending_deletes(&self, slot: &Slot) -> Vec<Uuid> {
        let queue = self.queue.clone();
        let slot = slot.clone();
        tokio::task::spawn_blocking(move || queue.read(&slot))
            .await
            .unwrap_or_default()
    }

    async fn settle_deletes(&self, slot: &Slot, done: Vec<Uuid>) {
        let queue = self.queue.clone();
        let slot = slot.clone();
        let _ = tokio::task::spawn_blocking(move || queue.settle(&slot, &done)).await;
    }
}

pub fn restarted(store: &Arc<Store>, id: Uuid, now: Millis) -> ChatResult<Option<Uuid>> {
    let Some(before) = store.upload(id)? else {
        return Ok(None);
    };
    store.upload_restart(id, now)?;
    let after = store.upload(id)?;
    Ok(before
        .media_id
        .filter(|_| after.is_some_and(|row| row.media_id.is_none())))
}
