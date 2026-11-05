use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};

use sc_chat::api::Api;
use sc_chat::media::queue::PutTargets;
use sc_chat::store::Store;
use sc_chat::{ChatError, ChatResult, Millis};
use tokio::sync::Notify;
use uuid::Uuid;

use super::delete_queue::DeleteQueue;
use super::files::Files;
use super::host::Host;
use super::picked::Picked;
use super::prepare::Prepare;
use crate::chat::media_cache::MediaCache;
use crate::network::edge::{self, Hop};

pub type Routes = Arc<dyn Fn(&str) -> Vec<Hop> + Send + Sync>;

pub struct Uploads {
    pub(super) api: Arc<Api>,
    pub(super) host: Arc<dyn Host>,
    pub(super) files: Files,
    pub(super) queue: Arc<DeleteQueue>,
    pub(super) cache: Arc<MediaCache>,
    pub(super) routes: Routes,
    pub(super) prepare: Prepare,
    pub(super) wake: Notify,
    pub(super) rested: AtomicBool,
    pub(super) stop: Notify,
    pub(super) current: Mutex<Option<Uuid>>,
    pub(super) targets: Mutex<HashMap<Uuid, PutTargets>>,
    pub(super) albums: tokio::sync::Mutex<()>,
    pub(super) deletes: tokio::sync::Mutex<()>,
    pub(super) halted: Mutex<Weak<Store>>,
    pub(super) picked: Picked,
}

impl Uploads {
    pub fn new(api: Arc<Api>, host: Arc<dyn Host>, cache: Arc<MediaCache>) -> Self {
        Self::routed(api, host, cache, Arc::new(edge::media_plan))
    }

    pub fn routed(
        api: Arc<Api>,
        host: Arc<dyn Host>,
        cache: Arc<MediaCache>,
        routes: Routes,
    ) -> Self {
        Self {
            api,
            host,
            files: Files::new(cache.chat_dir()),
            queue: Arc::new(DeleteQueue::new(cache.chat_dir())),
            cache,
            routes,
            prepare: Prepare::default(),
            wake: Notify::new(),
            rested: AtomicBool::new(false),
            stop: Notify::new(),
            current: Mutex::new(None),
            targets: Mutex::new(HashMap::new()),
            albums: tokio::sync::Mutex::new(()),
            deletes: tokio::sync::Mutex::new(()),
            halted: Mutex::new(Weak::new()),
            picked: Picked::default(),
        }
    }

    pub fn kick(&self) {
        self.wake.notify_one();
    }

    pub fn wake_all(&self) {
        self.rested.store(true, Ordering::SeqCst);
        self.kick();
    }

    pub(super) fn woken(&self) -> bool {
        self.rested.swap(false, Ordering::SeqCst)
    }

    pub async fn has_album(&self, album: Uuid) -> ChatResult<bool> {
        let uploads = self
            .blocking(move |store| store.album_uploads(album))
            .await?;
        Ok(!uploads.is_empty())
    }

    pub(super) fn store(&self) -> ChatResult<Arc<Store>> {
        self.host.store().ok_or(ChatError::NotReady)
    }

    pub(super) fn live_store(&self) -> Option<Arc<Store>> {
        self.host.store().filter(|store| !self.halted_on(store))
    }

    pub(super) fn halted_on(&self, store: &Arc<Store>) -> bool {
        self.halted
            .lock()
            .is_ok_and(|halted| Weak::ptr_eq(&halted, &Arc::downgrade(store)))
    }

    pub(super) fn now(&self) -> Millis {
        self.host.now_ms()
    }

    pub(super) async fn blocking<T, F>(&self, work: F) -> ChatResult<T>
    where
        T: Send + 'static,
        F: FnOnce(&Arc<Store>) -> ChatResult<T> + Send + 'static,
    {
        let store = self.store()?;
        tokio::task::spawn_blocking(move || work(&store))
            .await
            .map_err(|_| ChatError::Internal)?
    }

    pub(super) fn forget_targets(&self, id: Uuid) {
        if let Ok(mut targets) = self.targets.lock() {
            targets.remove(&id);
        }
    }

    pub(super) fn abort_if_current(&self, ids: &[Uuid]) {
        let current = self.current.lock().ok().and_then(|current| *current);
        if current.is_some_and(|id| ids.contains(&id)) {
            self.stop.notify_waiters();
        }
        for id in ids {
            self.forget_targets(*id);
        }
    }
}
