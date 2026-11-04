use std::path::{Path, PathBuf};
use std::sync::Arc;

use sc_chat::api::Api;
use sc_chat::crypto::DeviceKeys;
use sc_chat::outbox::Outbox;
use sc_chat::search::Search;
use sc_chat::store::Store;
use sc_chat::sync::SyncEngine;
use sc_chat::{ChatError, ChatResult, DeviceId, Events, KeyStore};

const DATABASE: &str = "chat.db";

pub struct Core {
    pub device_id: DeviceId,
    pub keys: Arc<DeviceKeys>,
    pub store: Arc<Store>,
    pub outbox: Outbox,
    pub search: Search,
    pub sync: SyncEngine,
}

impl Core {
    pub fn open(
        dir: &Path,
        keychain: &dyn KeyStore,
        api: Arc<Api>,
        events: Arc<dyn Events>,
    ) -> ChatResult<Self> {
        std::fs::create_dir_all(dir).map_err(|_| ChatError::Store)?;
        let (device_id, keys) = DeviceKeys::load_or_create(keychain)?;
        let store = Arc::new(Store::open_keyed(&database_path(dir), keychain)?);
        Ok(Self {
            device_id,
            keys: Arc::new(keys),
            outbox: Outbox::new(store.clone()),
            search: Search::new(store.clone()),
            sync: SyncEngine::new(api, store.clone(), events),
            store,
        })
    }
}

pub fn has_local_state(dir: &Path) -> bool {
    database_path(dir).exists()
}

pub fn database_path(dir: &Path) -> PathBuf {
    dir.join(DATABASE)
}
