use std::sync::Arc;
use std::time::Duration;

use sc_chat::api::Identity;
use sc_chat::api::wire::{ConfigView, RegisterDevice};
use sc_chat::{
    Access, ChatConfig, ChatError, ChatLimits, ChatPhase, ChatResult, KeyStore, MediaConfig, UserId,
};

use super::Runtime;
use super::local::Core;

const RETRY_MIN: Duration = Duration::from_secs(2);
const RETRY_MAX: Duration = Duration::from_secs(60);
const QUIET_KEYCHAIN_FAILURES: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Halt {
    Restart,
    Phase(ChatPhase),
    Retry(Duration),
    Wait(ChatPhase, Duration),
}

impl Runtime {
    pub(super) async fn bring_up(self: &Arc<Self>, failures: &mut u32) -> Result<Arc<Core>, Halt> {
        let session = crate::auth::session_token(Some(&self.app)).await;
        self.session.changed(session.as_deref());
        let Some(session_id) = session else {
            return Err(Halt::Phase(ChatPhase::SignedOut));
        };
        if self.keychain.denied() {
            self.set_core(None);
            return Err(Halt::Phase(ChatPhase::KeychainDenied));
        }
        if self.session.logged_out() {
            return Err(Halt::Phase(ChatPhase::Unbound));
        }
        self.status
            .update(|status| status.phase = ChatPhase::Starting);
        let core = self.open_core(failures).await?;
        self.api.set_identity(Some(Identity {
            session_id,
            device_id: core.device_id,
            keys: core.keys.clone(),
        }));
        let config = self
            .api
            .config()
            .await
            .map_err(|error| self.fail(&error, failures))?;
        let user_id = config.user_id.clone();
        let config = self.adopt_config(config);
        if !config.enabled {
            return Err(Halt::Phase(ChatPhase::Off));
        }
        let device = self
            .api
            .register_device(&registration(&self.app))
            .await
            .map_err(|error| self.fail(&error, failures))?;
        self.adopt_device(device.id);
        if let Some(user_id) = user_id {
            self.adopt_user(&core, user_id, failures).await?;
        }
        self.status.update(|status| {
            status.phase = ChatPhase::Ready;
            status.key_storage = self.keychain.storage();
        });
        let runtime = self.clone();
        self.rt
            .spawn(async move { runtime.refresh_blocked().await });
        Ok(core)
    }

    async fn adopt_user(
        &self,
        core: &Arc<Core>,
        user_id: UserId,
        failures: &mut u32,
    ) -> Result<(), Halt> {
        let store = core.store.clone();
        let me = user_id.clone();
        let other_account = self
            .rt
            .spawn_blocking(move || {
                let other = store.me()?.is_some_and(|known| known != me);
                if !other {
                    store.set_me(&me)?;
                }
                Ok(other)
            })
            .await
            .unwrap_or(Err(ChatError::Internal))
            .map_err(|error| self.fail(&error, failures))?;
        if other_account {
            let _ = self.wipe(false).await;
            return Err(Halt::Restart);
        }
        core.sync.set_user(Some(user_id.clone()));
        self.notifier.attach(
            core.store.clone(),
            user_id.clone(),
            self.api.channel().clone(),
        );
        self.status.update(|status| status.user_id = Some(user_id));
        Ok(())
    }

    pub async fn local_core(self: &Arc<Self>) -> ChatResult<Arc<Core>> {
        let _lifecycle = self.lifecycle.lock().await;
        if let Some(core) = self.core() {
            return Ok(core);
        }
        let runtime = self.clone();
        let core = self
            .rt
            .spawn_blocking(move || {
                runtime.keychain.sweep()?;
                Core::open(
                    &runtime.dir,
                    runtime.keychain.as_ref(),
                    runtime.api.clone(),
                    runtime.events.clone(),
                )
            })
            .await
            .unwrap_or(Err(ChatError::Internal))?;
        let core = Arc::new(core);
        self.set_core(Some(core.clone()));
        self.watch_expiry(&core);
        self.status
            .update(|status| status.key_storage = self.keychain.storage());
        Ok(core)
    }

    async fn open_core(self: &Arc<Self>, failures: &mut u32) -> Result<Arc<Core>, Halt> {
        match self.local_core().await {
            Ok(core) => Ok(core),
            Err(error @ ChatError::KeychainDenied) => Err(self.halt(&error, *failures)),
            Err(ChatError::Keychain) => {
                *failures += 1;
                if self.keychain.may_fall_back() && self.keychain.fall_back().is_ok() {
                    self.status
                        .update(|status| status.key_storage = self.keychain.storage());
                    return Err(Halt::Retry(Duration::ZERO));
                }
                Err(keychain_unavailable(*failures))
            }
            Err(error) => Err(self.fail(&error, failures)),
        }
    }

    fn adopt_config(&self, view: ConfigView) -> ChatConfig {
        let config = config_of(view);
        self.api.channel().use_ock(config.ock_current);
        self.api.channel().note_server_now(config.server_now);
        self.status
            .update(|status| status.send_paused = config.send_paused);
        if let Ok(mut current) = self.config.write() {
            *current = Some(config.clone());
        }
        config
    }

    fn fail(&self, error: &ChatError, failures: &mut u32) -> Halt {
        *failures += 1;
        self.halt(error, *failures)
    }

    pub(super) fn halt(&self, error: &ChatError, failures: u32) -> Halt {
        if let Some(phase) = parked_phase(error) {
            return Halt::Phase(phase);
        }
        match error {
            ChatError::Busy { retry_ms } => Halt::Retry(busy_retry(*retry_ms)),
            ChatError::Clock { server_now } => {
                self.api.channel().note_server_now(*server_now);
                Halt::Retry(clock_retry(failures))
            }
            _ => Halt::Retry(backoff(failures)),
        }
    }
}

pub(super) fn parked_phase(error: &ChatError) -> Option<ChatPhase> {
    match error {
        ChatError::ReloginRequired => Some(ChatPhase::Unbound),
        ChatError::SessionBoundOther => Some(ChatPhase::BoundOther),
        ChatError::DeviceRevoked => Some(ChatPhase::Revoked),
        ChatError::Disabled => Some(ChatPhase::Off),
        ChatError::KeychainDenied => Some(ChatPhase::KeychainDenied),
        _ => None,
    }
}

pub fn keychain_unavailable(failures: u32) -> Halt {
    let pause = backoff(failures);
    if failures > QUIET_KEYCHAIN_FAILURES {
        Halt::Wait(ChatPhase::KeychainUnavailable, pause)
    } else {
        Halt::Retry(pause)
    }
}

pub fn busy_retry(retry_ms: u64) -> Duration {
    let floor = u64::try_from(RETRY_MIN.as_millis()).unwrap_or(u64::MAX);
    let base = retry_ms.max(floor);
    Duration::from_millis(super::clock::spread(
        base,
        super::clock::jitter(base * 2 / 5),
    ))
}

pub fn clock_retry(failures: u32) -> Duration {
    if failures <= 1 {
        Duration::ZERO
    } else {
        backoff(failures)
    }
}

pub fn config_of(view: ConfigView) -> ChatConfig {
    ChatConfig {
        enabled: view.enabled,
        access: if view.access == "all" {
            Access::All
        } else {
            Access::Beta
        },
        send_paused: view.send_paused,
        hold_max_ms: view.hold_max_ms,
        server_now: view.server_now,
        incarnation: view.incarnation,
        ock_current: view.ock_current,
        limits: ChatLimits {
            text_max: view.limits.text_max,
            embeds_max: view.limits.embeds_max,
            group_members_max: view.limits.group_members_max,
            devices_max: view.limits.devices_max,
            envelope_max: view.limits.envelope_max,
            disappearing_ttls: view.limits.disappearing_ttls,
        },
        media: MediaConfig::from(&view.media),
    }
}

pub fn backoff(failures: u32) -> Duration {
    let exponent = failures.saturating_sub(1).min(5);
    let pause = RETRY_MIN.saturating_mul(1 << exponent).min(RETRY_MAX);
    let pause_ms = u64::try_from(pause.as_millis()).unwrap_or(u64::MAX);
    Duration::from_millis(super::clock::spread(
        pause_ms,
        super::clock::jitter(pause_ms * 2 / 5),
    ))
}

fn registration(app: &crate::rt::AppHandle) -> RegisterDevice {
    let (platform, name) = match std::env::consts::OS {
        "macos" => ("macos", "macOS"),
        "windows" => ("windows", "Windows"),
        _ => ("linux", "Linux"),
    };
    RegisterDevice {
        platform: platform.to_string(),
        name: name.to_string(),
        app_version: app.package_info().version.to_string(),
        caps: Vec::new(),
    }
}
