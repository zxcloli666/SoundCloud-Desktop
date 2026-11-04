use std::sync::Arc;

use sc_chat::api::wire::MediaSelection;
use sc_chat::store::Store;
use sc_chat::{ChatResult, Millis};
use uuid::Uuid;

use super::engine::Uploads;
use super::single::later;
use crate::app::diagnostics;

pub const DELETES: &str = "deletes.json";

impl Uploads {
    pub(super) async fn delete_on_server(&self, media: Vec<Uuid>) {
        if media.is_empty() {
            return;
        }
        let _held = self.deletes.lock().await;
        let mut pending = self.pending_deletes().await;
        for id in media {
            if !pending.contains(&id) {
                pending.push(id);
            }
        }
        if let Ok(listed) = serde_json::to_vec(&pending) {
            let _ = self.files.write_named(DELETES, &listed).await;
        }
        self.flush_deletes(pending).await;
    }

    pub(super) async fn retry_deletes(&self) {
        let _held = self.deletes.lock().await;
        let pending = self.pending_deletes().await;
        if !pending.is_empty() {
            self.flush_deletes(pending).await;
        }
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

    async fn pending_deletes(&self) -> Vec<Uuid> {
        let listed = self.files.read_named(DELETES).await;
        listed
            .and_then(|listed| serde_json::from_slice(&listed).ok())
            .unwrap_or_default()
    }

    async fn flush_deletes(&self, pending: Vec<Uuid>) {
        let selection = MediaSelection::ids(pending);
        match self.api.delete_media(&selection).await {
            Ok(_) => self.files.remove(vec![DELETES.to_string()]).await,
            Err(error) if later(&error) => {}
            Err(error) => {
                diagnostics::warn(format!("[ChatUpload] server delete refused: {error}"));
                self.files.remove(vec![DELETES.to_string()]).await;
            }
        }
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
