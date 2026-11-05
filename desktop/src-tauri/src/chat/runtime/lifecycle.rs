use std::sync::{Arc, RwLock};
use std::time::Duration;

use sc_chat::api::{Api, Identity};
use sc_chat::store::Store;
use sc_chat::{
    ChatConfig, ChatError, ChatPhase, ChatResult, CoreEvent, Events, HistoryGate, MediaUploadView,
    MediaUploadsEvent,
};
use tauri::Manager;

use crate::chat::keychain::ResetPlan;
use crate::chat::media_cache::MediaCache;
use crate::chat::state::ChatState;
use crate::chat::upload::UPLOADS_DIR;

use super::bringup::Halt;
use super::local::{Core, remove_database, remove_dir, wipe_store};
use super::status::StatusCell;
use super::{Runtime, clock};

const OFF_RECHECK: Duration = Duration::from_secs(3600);
const OFF_SPREAD_MS: u64 = 600_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Keys {
    Keep,
    Wipe,
    Reset(ResetPlan),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthMove {
    Stay,
    Restart,
    DropDevice,
}

impl Runtime {
    pub(super) fn reroute(&self) {
        let preferred = self.api.transport().tiers().first().copied();
        if preferred.is_some()
            && preferred != self.status.get().tier
            && let Some(core) = self.core()
        {
            core.sync.reset_network();
        }
    }

    pub async fn log_out(&self) -> ChatResult<()> {
        self.session.log_out();
        self.wipe(Keys::Wipe).await
    }

    pub(super) async fn auth_changed(&self) {
        let token = crate::auth::session_token(Some(&self.app)).await;
        let was_signed_in = self.session.signed_in();
        let changed = self.session.changed(token.as_deref());
        match auth_move(was_signed_in, token.is_some(), changed, self.status().phase) {
            AuthMove::DropDevice => self.drop_device().await,
            AuthMove::Restart => {
                self.session.log_in();
                self.restart();
            }
            AuthMove::Stay => {}
        }
    }

    async fn drop_device(&self) {
        let identity = self.api.identity();
        let _ = self.wipe(Keys::Wipe).await;
        if let Some(identity) = identity {
            self.remove_on_server(identity);
        }
    }

    pub(super) fn remove_on_server(&self, identity: Identity) {
        let api = Api::new(self.api.channel().clone(), self.api.transport().clone());
        api.set_identity(Some(identity));
        self.rt.spawn(async move {
            let _ = api.remove_this_device().await;
        });
    }

    pub async fn wipe(&self, keys: Keys) -> ChatResult<()> {
        let _lifecycle = self.lifecycle.lock().await;
        self.wipe_held(keys).await
    }

    pub(super) async fn wipe_held(&self, keys: Keys) -> ChatResult<()> {
        self.forget_user();
        self.unlimited();
        let chat = self.app.try_state::<ChatState>();
        let local_media = chat.as_ref().map(|state| state.media_cache.clone());
        if let Some(uploads) = chat.map(|state| state.uploads.clone()) {
            uploads.halt().await;
        }
        let core = self.core.write().ok().and_then(|mut core| core.take());
        self.api.set_identity(None);
        self.restart();
        let (wiped, gone) = match keys {
            Keys::Reset(plan) => self.reset_local(core, local_media, plan).await,
            Keys::Keep | Keys::Wipe => self.wipe_local(core, local_media, keys == Keys::Wipe).await,
        };
        if let Some(gone) = gone {
            self.events.emit(CoreEvent::MediaUploads(gone));
        }
        self.status.update(|status| {
            status.device_id = None;
            status.history = HistoryGate::default();
            status.unread = 0;
            status.mentions = 0;
            status.requests = 0;
        });
        wiped
    }

    async fn wipe_local(
        &self,
        core: Option<Arc<Core>>,
        local_media: Option<Arc<MediaCache>>,
        forget_device: bool,
    ) -> (ChatResult<()>, Option<MediaUploadsEvent>) {
        let keychain = self.keychain.clone();
        let dir = self.dir.clone();
        let uploads = self.dir.join(UPLOADS_DIR);
        self.rt
            .spawn_blocking(move || {
                let keys = if forget_device {
                    keychain.wipe()
                } else {
                    Ok(())
                };
                let gone = core.as_ref().and_then(|core| uploads_gone(&core.store));
                let steps = [
                    keys,
                    core.map_or_else(
                        || remove_database(&dir),
                        |core| wipe_store(&core.store, &dir),
                    ),
                    local_media.map_or(Ok(()), |cache| cache.clear().map(drop)),
                    remove_dir(&uploads),
                ];
                let wiped = steps.into_iter().collect::<ChatResult<Vec<()>>>().map(drop);
                (wiped, gone)
            })
            .await
            .unwrap_or((Err(ChatError::Internal), None))
    }

    fn forget_user(&self) {
        self.notifier.detach();
        if let Some(core) = self.core() {
            core.sync.set_user(None);
        }
        self.note_blocked([]);
        forget_account(&self.status, &self.config);
    }

    pub(super) fn set_core(&self, core: Option<Arc<Core>>) {
        if let Ok(mut current) = self.core.write() {
            *current = core;
        }
    }

    pub(super) async fn run(self: Arc<Self>) {
        let mut failures = 0;
        loop {
            let generation = self.signals.generation();
            let halt = match self.bring_up(&mut failures).await {
                Ok(core) => {
                    failures = 0;
                    self.drive(core, generation).await
                }
                Err(halt) => halt,
            };
            self.settle(halt, generation).await;
        }
    }

    pub(super) async fn settle(&self, halt: Halt, generation: u64) {
        match halt {
            Halt::Restart => {}
            Halt::Retry(pause) => {
                self.status.update(|status| status.online = false);
                tokio::select! {
                    _ = tokio::time::sleep(pause) => {}
                    _ = self.signals.restarted(generation) => {}
                }
            }
            Halt::Wait(phase, pause) => {
                self.status.update(|status| {
                    status.phase = phase;
                    status.online = false;
                });
                tokio::select! {
                    _ = tokio::time::sleep(pause) => {}
                    _ = self.signals.restarted(generation) => {}
                }
            }
            Halt::Phase(phase) => {
                if signed_out(phase) {
                    self.forget_user();
                }
                self.status.update(|status| {
                    status.phase = phase;
                    status.online = false;
                });
                let generation = if phase == ChatPhase::Revoked {
                    let _ = self.wipe(Keys::Wipe).await;
                    generation + 1
                } else {
                    generation
                };
                if phase == ChatPhase::Off {
                    let recheck = OFF_RECHECK + Duration::from_millis(clock::jitter(OFF_SPREAD_MS));
                    tokio::select! {
                        _ = tokio::time::sleep(recheck) => {}
                        _ = self.signals.restarted(generation) => {}
                    }
                } else {
                    self.signals.restarted(generation).await;
                }
            }
        }
    }
}

pub fn forget_account(status: &StatusCell, config: &RwLock<Option<ChatConfig>>) {
    if let Ok(mut config) = config.write() {
        *config = None;
    }
    status.update(|status| status.user_id = None);
}

pub fn uploads_present(store: &Store) -> MediaUploadsEvent {
    let uploads = store.uploads().unwrap_or_default();
    MediaUploadsEvent {
        uploads: uploads.iter().map(MediaUploadView::from).collect(),
        removed: Vec::new(),
    }
}

pub fn uploads_gone(store: &Store) -> Option<MediaUploadsEvent> {
    let removed: Vec<_> = store
        .uploads()
        .ok()?
        .iter()
        .map(|upload| upload.id)
        .collect();
    (!removed.is_empty()).then(|| MediaUploadsEvent {
        uploads: Vec::new(),
        removed,
    })
}

pub fn signed_out(phase: ChatPhase) -> bool {
    matches!(
        phase,
        ChatPhase::SignedOut | ChatPhase::Unbound | ChatPhase::BoundOther | ChatPhase::Revoked
    )
}

pub fn auth_move(
    was_signed_in: bool,
    signed_in: bool,
    changed: bool,
    phase: ChatPhase,
) -> AuthMove {
    if was_signed_in && !signed_in {
        return AuthMove::DropDevice;
    }
    let stuck = matches!(
        phase,
        ChatPhase::Unbound | ChatPhase::BoundOther | ChatPhase::Revoked
    );
    if changed || (signed_in && stuck) {
        AuthMove::Restart
    } else {
        AuthMove::Stay
    }
}
