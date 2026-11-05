use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use sc_chat::crypto::DeviceKeys;
use sc_chat::{ChatError, ChatResult, KeyName, KeyStorage, KeyStore};
use serde::Serialize;
use uuid::Uuid;

use super::{Keychain, Vault, erase, remove_marker};
use crate::app::diagnostics;
use crate::chat::runtime::clear_local;

const LATELY_MS: u64 = 7 * 24 * 3_600_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResetPlan {
    File,
    Probe,
    InPlace,
}

impl ResetPlan {
    fn label(self) -> &'static str {
        match self {
            ResetPlan::File => "file",
            ResetPlan::Probe => "probe",
            ResetPlan::InPlace => "in-place",
        }
    }

    fn parse(label: &str) -> Self {
        match label.trim() {
            "probe" => ResetPlan::Probe,
            "in-place" => ResetPlan::InPlace,
            _ => ResetPlan::File,
        }
    }
}

impl Keychain {
    pub fn reset(&self, plan: ResetPlan) -> ChatResult<()> {
        let _one_at_a_time = DeviceKeys::exclusive();
        let reset = self.reset_held(plan);
        if reset.is_err() {
            let _ = remove_marker(&self.resetting);
        }
        reset
    }

    pub fn reset_lately(&self) -> bool {
        std::fs::read_to_string(&self.reset)
            .ok()
            .and_then(|stamp| stamp.trim().parse().ok())
            .is_some_and(|at| lately(at, now_ms()))
    }

    pub(super) fn unfinished_reset(&self) -> Option<ResetPlan> {
        let label = match std::fs::read_to_string(&self.resetting) {
            Ok(label) => label,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return None,
            Err(_) => String::new(),
        };
        Some(ResetPlan::parse(&label))
    }

    pub(super) fn reset_held(&self, plan: ResetPlan) -> ChatResult<()> {
        let plan = if self.storage() == KeyStorage::File {
            ResetPlan::File
        } else {
            plan
        };
        write_marker(&self.resetting, plan.label())?;
        clear_local(&self.dir)?;
        let storage = match plan {
            ResetPlan::File => KeyStorage::File,
            ResetPlan::Probe => self.os_passes(probe),
            ResetPlan::InPlace => self.os_passes(empty),
        };
        if storage == KeyStorage::File {
            self.file.create()?;
            empty(&self.file)?;
        }
        self.set_storage(storage);
        remove_marker(&self.stale)?;
        remove_marker(&self.made)?;
        write_marker(&self.reset, &now_ms().to_string())?;
        remove_marker(&self.resetting)?;
        self.allow();
        diagnostics::log(
            "INFO",
            format!(
                "[chat] chat keys were reset ({}), new keys go to {storage:?}",
                plan.label()
            ),
        );
        Ok(())
    }

    fn os_passes(&self, check: fn(&dyn Vault) -> ChatResult<()>) -> KeyStorage {
        let _one_prompt_at_a_time = self.asking.lock();
        match check(self.os.as_ref()) {
            Ok(()) => KeyStorage::Os,
            Err(error) => {
                diagnostics::warn(format!("[chat] the os keychain failed a reset: {error}"));
                KeyStorage::File
            }
        }
    }
}

fn empty(vault: &dyn Vault) -> ChatResult<()> {
    KeyName::ALL
        .into_iter()
        .try_for_each(|name| erase(vault, name))
}

fn probe(vault: &dyn Vault) -> ChatResult<()> {
    empty(vault)?;
    let sample = Uuid::new_v4().into_bytes();
    vault.save(KeyName::Database, &sample)?;
    let back = vault.load(KeyName::Database)?;
    erase(vault, KeyName::Database)?;
    if back.is_some_and(|back| back.as_slice() == sample.as_slice()) {
        Ok(())
    } else {
        Err(ChatError::Keychain)
    }
}

fn write_marker(path: &Path, text: &str) -> ChatResult<()> {
    std::fs::write(path, text).map_err(|error| {
        diagnostics::warn(format!("[chat] key marker: {error}"));
        ChatError::Store
    })
}

fn lately(at: u64, now: u64) -> bool {
    now.saturating_sub(at) < LATELY_MS
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| {
            u64::try_from(since.as_millis()).unwrap_or(u64::MAX)
        })
}

#[cfg(test)]
mod tests;
