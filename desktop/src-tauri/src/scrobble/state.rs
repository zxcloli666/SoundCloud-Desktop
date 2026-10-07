use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Mutex;

use super::error::ApiError;
use super::lastfm::{self, Credentials};
use super::listenbrainz::{self, ListenType};
use super::store::{self, Accounts, Profile, Queue, Scrobble};
use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;

const EVENT: &str = "scrobble:changed";
const FLUSH_EVERY: Duration = Duration::from_secs(120);
const FIRST_FLUSH_AFTER: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Service {
    Lastfm,
    Listenbrainz,
}

const SERVICES: [Service; 2] = [Service::Lastfm, Service::Listenbrainz];

enum Auth {
    Lastfm(Credentials, String),
    Listenbrainz(String),
}

#[derive(Serialize)]
pub struct ServiceStatus {
    available: bool,
    profile: Option<Profile>,
    pending: usize,
}

#[derive(Serialize)]
pub struct Status {
    lastfm: ServiceStatus,
    listenbrainz: ServiceStatus,
}

#[derive(Default)]
struct Data {
    accounts: Accounts,
    queue: Queue,
    lastfm_token: Option<String>,
}

impl Data {
    fn list(&mut self, service: Service) -> &mut Vec<Scrobble> {
        match service {
            Service::Lastfm => &mut self.queue.lastfm,
            Service::Listenbrainz => &mut self.queue.listenbrainz,
        }
    }

    fn auth(&self, service: Service) -> Option<Auth> {
        match service {
            Service::Lastfm => {
                let account = self.accounts.lastfm.as_ref()?;
                Some(Auth::Lastfm(lastfm::credentials()?, account.key.clone()))
            }
            Service::Listenbrainz => {
                let account = self.accounts.listenbrainz.as_ref()?;
                Some(Auth::Listenbrainz(account.token.clone()))
            }
        }
    }

    fn forget(&mut self, service: Service) {
        match service {
            Service::Lastfm => self.accounts.lastfm = None,
            Service::Listenbrainz => self.accounts.listenbrainz = None,
        }
    }

    fn set_profile(&mut self, service: Service, profile: Profile) {
        match service {
            Service::Lastfm => {
                if let Some(account) = self.accounts.lastfm.as_mut() {
                    account.profile = profile;
                }
            }
            Service::Listenbrainz => {
                if let Some(account) = self.accounts.listenbrainz.as_mut() {
                    account.profile = profile;
                }
            }
        }
    }

    fn status(&self) -> Status {
        Status {
            lastfm: ServiceStatus {
                available: lastfm::credentials().is_some(),
                profile: self.accounts.lastfm.as_ref().map(|a| a.profile.clone()),
                pending: self.queue.lastfm.len(),
            },
            listenbrainz: ServiceStatus {
                available: true,
                profile: self
                    .accounts
                    .listenbrainz
                    .as_ref()
                    .map(|a| a.profile.clone()),
                pending: self.queue.listenbrainz.len(),
            },
        }
    }
}

pub struct ScrobbleState {
    dir: PathBuf,
    pub(super) http: wreq::Client,
    app: AppHandle,
    data: Mutex<Data>,
    flushing: Mutex<()>,
}

impl ScrobbleState {
    pub fn init(
        dir: PathBuf,
        http: wreq::Client,
        app: AppHandle,
        rt: &tokio::runtime::Handle,
    ) -> Arc<Self> {
        let data = Data {
            accounts: store::load(&dir.join(store::ACCOUNTS_FILE)),
            queue: store::load(&dir.join(store::QUEUE_FILE)),
            lastfm_token: None,
        };
        let state = Arc::new(Self {
            dir,
            http,
            app,
            data: Mutex::new(data),
            flushing: Mutex::new(()),
        });
        let worker = state.clone();
        rt.spawn(async move {
            tokio::time::sleep(FIRST_FLUSH_AFTER).await;
            loop {
                worker.flush_all().await;
                tokio::time::sleep(FLUSH_EVERY).await;
            }
        });
        state
    }

    fn log(&self, message: impl AsRef<str>) {
        log_native(
            &self.app,
            "warn",
            format!("[scrobble] {}", message.as_ref()),
        );
    }

    fn notify(&self) {
        let _ = self.app.emit(EVENT, ());
    }

    fn persist_accounts(&self, data: &Data) {
        if let Err(e) = store::save(&self.dir.join(store::ACCOUNTS_FILE), &data.accounts) {
            self.log(format!("save accounts failed: {e}"));
        }
    }

    fn persist_queue(&self, data: &Data) {
        if let Err(e) = store::save(&self.dir.join(store::QUEUE_FILE), &data.queue) {
            self.log(format!("save queue failed: {e}"));
        }
    }

    pub async fn status(&self) -> Status {
        self.data.lock().await.status()
    }

    async fn drop_session(&self, service: Service) {
        let mut data = self.data.lock().await;
        data.forget(service);
        self.persist_accounts(&data);
        drop(data);
        self.notify();
    }

    pub async fn disconnect(&self, service: Service) -> Status {
        let _flush = self.flushing.lock().await;
        let mut data = self.data.lock().await;
        data.forget(service);
        data.list(service).clear();
        self.persist_accounts(&data);
        self.persist_queue(&data);
        let status = data.status();
        drop(data);
        self.notify();
        status
    }

    pub async fn set_lastfm_token(&self, token: Option<String>) {
        self.data.lock().await.lastfm_token = token;
    }

    pub async fn lastfm_token(&self) -> Option<String> {
        self.data.lock().await.lastfm_token.clone()
    }

    pub async fn connect_lastfm(&self, key: String, profile: Profile) -> Status {
        let mut data = self.data.lock().await;
        data.lastfm_token = None;
        data.accounts.lastfm = Some(store::LastfmAccount { key, profile });
        self.persist_accounts(&data);
        let status = data.status();
        drop(data);
        self.notify();
        status
    }

    pub async fn connect_listenbrainz(&self, token: String, profile: Profile) -> Status {
        let mut data = self.data.lock().await;
        data.accounts.listenbrainz = Some(store::ListenbrainzAccount { token, profile });
        self.persist_accounts(&data);
        let status = data.status();
        drop(data);
        self.notify();
        status
    }

    pub async fn refresh_profiles(&self) -> Status {
        for service in SERVICES {
            let (auth, name) = {
                let data = self.data.lock().await;
                let name = match service {
                    Service::Lastfm => data
                        .accounts
                        .lastfm
                        .as_ref()
                        .map(|a| a.profile.name.clone()),
                    Service::Listenbrainz => data
                        .accounts
                        .listenbrainz
                        .as_ref()
                        .map(|a| a.profile.name.clone()),
                };
                (data.auth(service), name)
            };
            let (Some(auth), Some(name)) = (auth, name) else {
                continue;
            };
            let fetched = match auth {
                Auth::Lastfm(creds, _) => lastfm::profile(&self.http, creds, &name).await,
                Auth::Listenbrainz(_) => listenbrainz::profile(&self.http, &name).await,
            };
            match fetched {
                Ok(profile) => {
                    let mut data = self.data.lock().await;
                    data.set_profile(service, profile);
                    self.persist_accounts(&data);
                }
                Err(e) => self.log(format!("profile refresh failed: {e}")),
            }
        }
        self.status().await
    }

    async fn send(&self, auth: &Auth, batch: &[Scrobble]) -> Result<(), ApiError> {
        match auth {
            Auth::Lastfm(creds, key) => lastfm::scrobble(&self.http, *creds, key, batch).await,
            Auth::Listenbrainz(token) => {
                let kind = ListenType::for_batch(batch.len());
                listenbrainz::submit(&self.http, token, batch, kind).await
            }
        }
    }

    async fn flush(&self, service: Service) {
        let batch_size = match service {
            Service::Lastfm => lastfm::BATCH,
            Service::Listenbrainz => listenbrainz::BATCH,
        };
        let mut changed = false;
        loop {
            let (batch, auth) = {
                let mut data = self.data.lock().await;
                let auth = data.auth(service);
                let list = data.list(service);
                let batch: Vec<Scrobble> = list.iter().take(batch_size).cloned().collect();
                (batch, auth)
            };
            let Some(auth) = auth else { break };
            if batch.is_empty() {
                break;
            }
            match self.send(&auth, &batch).await {
                Ok(()) => {}
                Err(ApiError::Rejected(detail)) => self.log(format!("batch rejected: {detail}")),
                Err(ApiError::Session) => {
                    self.drop_session(service).await;
                    break;
                }
                Err(e) => {
                    self.log(format!("flush postponed: {e}"));
                    break;
                }
            }
            let mut data = self.data.lock().await;
            let list = data.list(service);
            let sent = batch.len().min(list.len());
            list.drain(..sent);
            self.persist_queue(&data);
            changed = true;
        }
        if changed {
            self.notify();
        }
    }

    pub async fn flush_all(&self) {
        let _flush = self.flushing.lock().await;
        for service in SERVICES {
            self.flush(service).await;
        }
    }

    pub async fn enqueue(&self, track: Scrobble) {
        {
            let mut data = self.data.lock().await;
            let mut queued = false;
            for service in SERVICES {
                if data.auth(service).is_some() {
                    Queue::push(data.list(service), track.clone());
                    queued = true;
                }
            }
            if !queued {
                return;
            }
            self.persist_queue(&data);
        }
        self.notify();
        self.flush_all().await;
    }

    pub async fn now_playing(&self, track: Scrobble) {
        for service in SERVICES {
            let auth = self.data.lock().await.auth(service);
            let result = match auth {
                Some(Auth::Lastfm(creds, key)) => {
                    lastfm::now_playing(&self.http, creds, &key, &track).await
                }
                Some(Auth::Listenbrainz(token)) => {
                    let batch = std::slice::from_ref(&track);
                    listenbrainz::submit(&self.http, &token, batch, ListenType::PlayingNow).await
                }
                None => continue,
            };
            match result {
                Ok(()) => {}
                Err(ApiError::Session) => self.drop_session(service).await,
                Err(e) => self.log(format!("now playing failed: {e}")),
            }
        }
    }
}
