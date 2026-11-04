mod activity;
mod blocked;
mod bringup;
mod clock;
mod drive;
mod expiry;
mod lifecycle;
mod local;
mod session;
mod signals;
mod status;
mod tap;
mod visibility;
mod wake;

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, RwLock};
use std::time::Instant;

use sc_chat::api::Api;
use sc_chat::{ChatConfig, ChatError, ChatResult, ChatStatus, Clock, ConvId, DeviceId, UserId};
use tauri::Listener;

use super::keychain::Keychain;
use super::notify::Notifier;
use super::state::ChatState;
use crate::rt::AppHandle;
use session::Session;
use signals::Signals;

pub use bringup::config_of;
pub use clock::SystemClock;
pub use local::{Core, database_path};
pub use status::StatusCell;
pub use tap::Tap;

const AUTH_CHANGED: &str = "auth:changed";
const EDGE_CHANGED: &str = "edge:config";

pub struct Runtime {
    app: AppHandle,
    rt: tokio::runtime::Handle,
    dir: PathBuf,
    keychain: Arc<Keychain>,
    api: Arc<Api>,
    clock: Arc<dyn Clock>,
    events: Arc<Tap>,
    signals: Signals,
    status: Arc<StatusCell>,
    notifier: Arc<Notifier>,
    blocked: RwLock<HashSet<UserId>>,
    lifecycle: tokio::sync::Mutex<()>,
    core: RwLock<Option<Arc<Core>>>,
    config: RwLock<Option<ChatConfig>>,
    session: Session,
    typing_sent: Mutex<HashMap<ConvId, Instant>>,
}

pub struct Parts {
    pub app: AppHandle,
    pub rt: tokio::runtime::Handle,
    pub dir: PathBuf,
    pub keychain: Arc<Keychain>,
    pub api: Arc<Api>,
    pub clock: Arc<dyn Clock>,
    pub events: Arc<Tap>,
    pub status: Arc<StatusCell>,
    pub notifier: Arc<Notifier>,
}

pub fn start(state: &ChatState) {
    let runtime = state.runtime.clone();
    visibility::watch(&state.app, runtime.clone(), &state.rt);
    wake::watch(runtime.clone(), &state.rt);
    let watcher = runtime.clone();
    state.app.listen_any(AUTH_CHANGED, move |_| {
        let runtime = watcher.clone();
        watcher
            .rt
            .spawn(async move { runtime.auth_changed().await });
    });
    let rerouted = runtime.clone();
    state
        .app
        .listen_any(EDGE_CHANGED, move |_| rerouted.reroute());
    state.rt.spawn(runtime.run());
}

impl Runtime {
    pub fn new(parts: Parts) -> Self {
        Self {
            app: parts.app,
            rt: parts.rt,
            dir: parts.dir,
            keychain: parts.keychain,
            api: parts.api,
            clock: parts.clock,
            events: parts.events,
            status: parts.status,
            notifier: parts.notifier,
            blocked: RwLock::new(HashSet::new()),
            signals: Signals::new(),
            lifecycle: tokio::sync::Mutex::new(()),
            core: RwLock::new(None),
            config: RwLock::new(None),
            session: Session::default(),
            typing_sent: Mutex::new(HashMap::new()),
        }
    }

    pub fn status(&self) -> ChatStatus {
        self.status.get()
    }

    pub fn core(&self) -> Option<Arc<Core>> {
        self.core.read().ok().and_then(|core| core.clone())
    }

    pub fn ready(&self) -> ChatResult<Arc<Core>> {
        self.core().ok_or(ChatError::NotReady)
    }

    pub fn config(&self) -> Option<ChatConfig> {
        self.config.read().ok().and_then(|config| config.clone())
    }

    pub fn now_ms(&self) -> i64 {
        self.clock.now_ms()
    }

    pub fn typing(&self, conversation_id: ConvId) -> Vec<UserId> {
        self.events.typing(conversation_id)
    }

    pub fn kick(&self) {
        if let Some(core) = self.core() {
            core.sync.kick();
        }
    }

    pub fn restart(&self) {
        self.signals.restart();
    }

    pub fn adopt_device(&self, device_id: DeviceId) {
        self.status
            .update(|status| status.device_id = Some(device_id));
    }

    pub fn set_visible(&self, visible: bool) {
        if !self.signals.set_visible(visible) {
            return;
        }
        self.status.update(|status| status.visible = visible);
        if let Some(core) = self.core() {
            core.sync.set_visible(visible);
        }
    }

    pub fn woke_up(&self) {
        if let Some(core) = self.core() {
            core.sync.reset_network();
        }
    }
}

#[cfg(test)]
mod tests;
