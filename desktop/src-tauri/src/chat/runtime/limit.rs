use std::sync::Mutex;
use std::time::Duration;

use sc_chat::{ChatError, ChatPhase, Millis};
use serde::Serialize;
use tauri::Emitter;

use super::bringup::Halt;
use super::{Runtime, clock};
use crate::chat::events::DEVICE_LIMIT;

const WINDOW_MS: Millis = 24 * 3_600_000;
const RECHECK_MS: u64 = 5 * 60_000;

#[derive(Default)]
pub struct SignInLimit {
    current: Mutex<Option<DeviceLimit>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum DeviceLimit {
    Daily { opens_by: Millis },
    Cap { devices_max: u32 },
}

impl SignInLimit {
    pub fn get(&self) -> Option<DeviceLimit> {
        self.current.lock().ok().and_then(|current| *current)
    }

    pub fn set(&self, next: Option<DeviceLimit>) -> bool {
        let Ok(mut current) = self.current.lock() else {
            return false;
        };
        let changed = *current != next;
        *current = next;
        changed
    }
}

impl Runtime {
    pub fn device_limit(&self) -> Option<DeviceLimit> {
        self.limit.get()
    }

    pub(super) fn limited(&self, error: &ChatError, devices_max: u32) -> Option<Halt> {
        let limit = next_limit(error, self.limit.get(), self.now_ms(), devices_max)?;
        self.note_limit(Some(limit));
        Some(limit_wait())
    }

    pub(super) fn unlimited(&self) {
        self.note_limit(None);
    }

    fn note_limit(&self, limit: Option<DeviceLimit>) {
        if self.limit.set(limit) {
            let _ = self.app.emit(DEVICE_LIMIT, limit);
        }
    }
}

pub fn next_limit(
    error: &ChatError,
    known: Option<DeviceLimit>,
    now: Millis,
    devices_max: u32,
) -> Option<DeviceLimit> {
    match error {
        ChatError::RequestLimit => Some(DeviceLimit::Daily {
            opens_by: opens_by(known, now),
        }),
        ChatError::DeviceCap => Some(DeviceLimit::Cap { devices_max }),
        _ => None,
    }
}

pub fn opens_by(known: Option<DeviceLimit>, now: Millis) -> Millis {
    match known {
        Some(DeviceLimit::Daily { opens_by }) if opens_by > now => opens_by,
        _ => now + WINDOW_MS,
    }
}

pub fn limit_wait() -> Halt {
    let pause = clock::spread(RECHECK_MS, clock::jitter(RECHECK_MS * 2 / 5));
    Halt::Wait(ChatPhase::Starting, Duration::from_millis(pause))
}
