use std::sync::Mutex;
use std::time::Duration;

use sc_chat::{ChatPhase, Millis};
use serde::Serialize;
use tauri::Emitter;

use super::bringup::Halt;
use super::{Runtime, clock};
use crate::chat::events::DEVICE_LIMIT;

const WINDOW_MS: Millis = 24 * 3_600_000;
const RECHECK_MS: u64 = 5 * 60_000;

#[derive(Default)]
pub struct SignInLimit {
    opens_by: Mutex<Option<Millis>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceLimit {
    pub opens_by: Option<Millis>,
}

impl SignInLimit {
    pub fn get(&self) -> Option<Millis> {
        self.opens_by.lock().ok().and_then(|opens_by| *opens_by)
    }

    pub fn set(&self, next: Option<Millis>) -> bool {
        let Ok(mut opens_by) = self.opens_by.lock() else {
            return false;
        };
        let changed = *opens_by != next;
        *opens_by = next;
        changed
    }
}

impl Runtime {
    pub fn device_limit(&self) -> DeviceLimit {
        DeviceLimit {
            opens_by: self.limit.get(),
        }
    }

    pub(super) fn limited(&self) -> Halt {
        self.note_limit(Some(opens_by(self.limit.get(), self.now_ms())));
        limit_wait()
    }

    pub(super) fn unlimited(&self) {
        self.note_limit(None);
    }

    fn note_limit(&self, opens_by: Option<Millis>) {
        if self.limit.set(opens_by) {
            let _ = self.app.emit(DEVICE_LIMIT, DeviceLimit { opens_by });
        }
    }
}

pub fn opens_by(known: Option<Millis>, now: Millis) -> Millis {
    match known {
        Some(at) if at > now => at,
        _ => now + WINDOW_MS,
    }
}

pub fn limit_wait() -> Halt {
    let pause = clock::spread(RECHECK_MS, clock::jitter(RECHECK_MS * 2 / 5));
    Halt::Wait(ChatPhase::Starting, Duration::from_millis(pause))
}
