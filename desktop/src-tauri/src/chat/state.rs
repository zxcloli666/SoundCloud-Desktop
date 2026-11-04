use std::path::PathBuf;
use std::sync::Arc;

use sc_chat::api::Api;
use sc_chat::channel::Channel;
use sc_chat::{ChatResult, ChatStatus, Clock, Events, KeyStore, Transport};

use super::events::TauriEvents;
use super::keychain::Keychain;
use super::media_cache::MediaCache;
use super::notify::Notifier;
use super::runtime::{Core, Parts, Runtime, StatusCell, SystemClock, Tap};
use super::transport::{EdgeTransport, Route};
use super::upload::{RuntimeHost, Uploads};
use crate::rt::AppHandle;

const KEYCHAIN_SUFFIX: &str = ".chat";

pub struct ChatState {
    pub app: AppHandle,
    pub rt: tokio::runtime::Handle,
    pub keys: Arc<dyn KeyStore>,
    pub transport: Arc<dyn Transport>,
    pub events: Arc<dyn Events>,
    pub api: Arc<Api>,
    pub runtime: Arc<Runtime>,
    pub notifier: Arc<Notifier>,
    pub media_cache: Arc<MediaCache>,
    pub uploads: Arc<Uploads>,
}

impl ChatState {
    pub fn new(app: AppHandle, rt: tokio::runtime::Handle, dir: PathBuf) -> Self {
        let service = format!("{}{KEYCHAIN_SUFFIX}", app.config().identifier);
        let keychain = Arc::new(Keychain::new(&service, &dir));
        let raw: Arc<dyn Events> = Arc::new(TauriEvents::new(app.clone()));
        let status = Arc::new(StatusCell::new(raw.clone()));
        let tap = Arc::new(Tap::new(raw, status.clone()));
        let clock: Arc<dyn Clock> = Arc::new(SystemClock);
        let transport: Arc<dyn Transport> = Arc::new(EdgeTransport::new(Route::from_env()));
        let channel = Arc::new(Channel::new(clock.clone()));
        let api = Arc::new(Api::new(channel, transport.clone()));
        let notifier = Arc::new(Notifier::default());
        let media_cache = Arc::new(MediaCache::open(&dir));
        let runtime = Arc::new(Runtime::new(Parts {
            app: app.clone(),
            rt: rt.clone(),
            dir,
            keychain: keychain.clone(),
            api: api.clone(),
            clock,
            events: tap.clone(),
            status,
            notifier: notifier.clone(),
        }));
        let host = Arc::new(RuntimeHost::new(app.clone(), &runtime));
        let uploads = Arc::new(Uploads::new(api.clone(), host, media_cache.clone()));
        Self {
            app,
            rt,
            keys: keychain,
            transport,
            events: tap,
            api,
            runtime,
            notifier,
            media_cache,
            uploads,
        }
    }

    pub fn status(&self) -> ChatStatus {
        self.runtime.status()
    }

    pub fn core(&self) -> ChatResult<Arc<Core>> {
        self.runtime.ready()
    }

    pub async fn log_out(&self) -> ChatResult<()> {
        self.runtime.log_out().await
    }
}
