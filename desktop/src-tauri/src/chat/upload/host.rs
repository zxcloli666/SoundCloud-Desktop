use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Weak};

use sc_chat::media::{ALBUM_MAX, ROOM_ALBUM_MAX};
use sc_chat::store::Store;
use sc_chat::{ChatError, Millis};
use serde::Serialize;
use serde_json::Value;
use tauri::{Emitter, Listener};
use uuid::Uuid;

use super::engine::Uploads;
use crate::chat::events::STATUS;
use crate::chat::runtime::Runtime;
use crate::rt::AppHandle;

pub const UPLOAD_ERROR: &str = "chat:media-upload-error";

pub trait Host: Send + Sync {
    fn store(&self) -> Option<Arc<Store>>;
    fn now_ms(&self) -> Millis;
    fn sent(&self);
    fn failed(&self, id: Uuid, error: &ChatError);
    fn album_max(&self, room: bool) -> usize;
}

#[derive(Debug, Clone, Serialize)]
pub struct UploadError<'a> {
    pub id: Uuid,
    pub error: &'a ChatError,
}

pub struct RuntimeHost {
    app: AppHandle,
    runtime: Weak<Runtime>,
}

impl RuntimeHost {
    pub fn new(app: AppHandle, runtime: &Arc<Runtime>) -> Self {
        Self {
            app,
            runtime: Arc::downgrade(runtime),
        }
    }
}

impl Host for RuntimeHost {
    fn store(&self) -> Option<Arc<Store>> {
        Some(self.runtime.upgrade()?.core()?.store.clone())
    }

    fn now_ms(&self) -> Millis {
        self.runtime
            .upgrade()
            .map_or_else(wall_ms, |runtime| runtime.now_ms())
    }

    fn sent(&self) {
        if let Some(runtime) = self.runtime.upgrade() {
            runtime.kick();
        }
    }

    fn failed(&self, id: Uuid, error: &ChatError) {
        let _ = self.app.emit(UPLOAD_ERROR, UploadError { id, error });
    }

    fn album_max(&self, room: bool) -> usize {
        let limits = self
            .runtime
            .upgrade()
            .and_then(|runtime| runtime.config())
            .map(|config| config.media.limits);
        let (all, rooms) = limits.map_or((0, 0), |limits| {
            (limits.album_max as usize, limits.room_album_max as usize)
        });
        match room {
            true if rooms > 0 => rooms.min(ROOM_ALBUM_MAX),
            true => ROOM_ALBUM_MAX,
            false if all > 0 => all.min(ALBUM_MAX),
            false => ALBUM_MAX,
        }
    }
}

fn wall_ms() -> Millis {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |since| {
            Millis::try_from(since.as_millis()).unwrap_or(Millis::MAX)
        })
}

pub fn watch(app: &AppHandle, uploads: &Arc<Uploads>) {
    let uploads = Arc::downgrade(uploads);
    let was_up = AtomicBool::new(false);
    app.listen_any(STATUS, move |event| {
        let up = serde_json::from_str::<Value>(event.payload()).is_ok_and(|status| {
            status["phase"] == "ready" && status["online"].as_bool() == Some(true)
        });
        let came_up = !was_up.swap(up, Ordering::Relaxed) && up;
        if came_up && let Some(uploads) = uploads.upgrade() {
            uploads.kick();
        }
    });
}
