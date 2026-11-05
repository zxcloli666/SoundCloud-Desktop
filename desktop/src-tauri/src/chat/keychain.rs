mod file;
#[cfg(feature = "chat-lab")]
mod memory;
#[cfg(not(feature = "chat-lab"))]
mod os;
#[cfg(test)]
pub(crate) mod testing;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use sc_chat::crypto::DeviceKeys;
use sc_chat::{ChatError, ChatResult, KeyName, KeyStorage, KeyStore, Zeroizing};
use tokio::sync::Notify;

use super::runtime::database_path;
use crate::app::diagnostics;

use file::FileVault;
#[cfg(not(feature = "chat-lab"))]
use os::OsVault;

const STALE: &str = "keys-stale";

pub trait Vault: Send + Sync {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>>;

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()>;

    fn delete(&self, name: KeyName) -> ChatResult<()>;
}

pub struct Keychain {
    os: Box<dyn Vault>,
    file: FileVault,
    database: PathBuf,
    stale: PathBuf,
    storage: Mutex<KeyStorage>,
    denied: AtomicBool,
    refusals: Notify,
    asking: Mutex<()>,
}

impl Keychain {
    pub fn new(service: &str, dir: &Path) -> Self {
        Self::with_os(device_vault(service), dir)
    }

    pub(crate) fn with_os(os: Box<dyn Vault>, dir: &Path) -> Self {
        let file = FileVault::new(dir);
        let storage = if file.exists() {
            KeyStorage::File
        } else {
            KeyStorage::Os
        };
        Self {
            os,
            file,
            database: database_path(dir),
            stale: dir.join(STALE),
            storage: Mutex::new(storage),
            denied: AtomicBool::new(false),
            refusals: Notify::new(),
            asking: Mutex::new(()),
        }
    }

    pub fn denied(&self) -> bool {
        self.denied.load(Ordering::SeqCst)
    }

    pub fn allow(&self) {
        self.denied.store(false, Ordering::SeqCst);
    }

    pub fn refusals(&self) -> &Notify {
        &self.refusals
    }

    pub fn may_fall_back(&self) -> bool {
        should_fall_back(self.storage(), self.has_local_state())
    }

    fn has_local_state(&self) -> bool {
        self.database.exists() || self.stale.exists()
    }

    pub fn fall_back(&self) -> ChatResult<()> {
        self.file.create()?;
        self.set_storage(KeyStorage::File);
        diagnostics::warn("[chat] the os keychain is unavailable, chat keys moved to a 0600 file");
        Ok(())
    }

    pub fn wipe(&self) -> ChatResult<()> {
        let _one_at_a_time = DeviceKeys::exclusive();
        self.wipe_held()
    }

    fn wipe_held(&self) -> ChatResult<()> {
        let storage = self.storage();
        let wiped = KeyName::ALL
            .into_iter()
            .try_for_each(|name| self.ask(storage, |vault| vault.delete(name)));
        match wiped {
            Ok(()) => remove_marker(&self.stale),
            Err(error) => {
                if let Err(marker) = std::fs::write(&self.stale, []) {
                    diagnostics::warn(format!("[chat] stale key marker: {marker}"));
                }
                Err(error)
            }
        }
    }

    pub fn sweep(&self) -> ChatResult<()> {
        if !self.stale.exists() {
            return Ok(());
        }
        let _one_at_a_time = DeviceKeys::exclusive();
        if self.stale.exists() {
            self.wipe_held()
        } else {
            Ok(())
        }
    }

    fn set_storage(&self, storage: KeyStorage) {
        if let Ok(mut current) = self.storage.lock() {
            *current = storage;
        }
    }

    fn vault(&self, storage: KeyStorage) -> &dyn Vault {
        match storage {
            KeyStorage::Os => self.os.as_ref(),
            KeyStorage::File => &self.file,
        }
    }

    fn ask<T>(
        &self,
        storage: KeyStorage,
        op: impl Fn(&dyn Vault) -> ChatResult<T>,
    ) -> ChatResult<T> {
        let _one_prompt_at_a_time = self.asking.lock();
        if storage == KeyStorage::Os && self.denied() {
            return Err(ChatError::KeychainDenied);
        }
        let done = op(self.vault(storage));
        if matches!(done, Err(ChatError::KeychainDenied))
            && !self.denied.swap(true, Ordering::SeqCst)
        {
            diagnostics::warn(
                "[chat] keychain access was refused, chat waits for the user to retry",
            );
            self.refusals.notify_one();
        }
        done
    }

    fn run<T>(&self, op: impl Fn(&dyn Vault) -> ChatResult<T>) -> ChatResult<T> {
        let storage = self.storage();
        match self.ask(storage, &op) {
            Err(ChatError::Keychain) if self.may_fall_back() => {
                self.fall_back()?;
                self.ask(KeyStorage::File, &op)
            }
            done => done,
        }
    }
}

impl KeyStore for Keychain {
    fn storage(&self) -> KeyStorage {
        self.storage
            .lock()
            .map(|storage| *storage)
            .unwrap_or(KeyStorage::Os)
    }

    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        self.run(|vault| vault.load(name))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        self.run(|vault| vault.save(name, secret))
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        self.run(|vault| vault.delete(name))
    }
}

#[cfg(not(feature = "chat-lab"))]
fn device_vault(service: &str) -> Box<dyn Vault> {
    Box::new(OsVault::new(service))
}

#[cfg(feature = "chat-lab")]
fn device_vault(_service: &str) -> Box<dyn Vault> {
    Box::new(memory::MemoryVault::default())
}

fn remove_marker(path: &Path) -> ChatResult<()> {
    match std::fs::remove_file(path) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
            diagnostics::warn(format!("[chat] stale key marker: {error}"));
            Err(ChatError::Store)
        }
        _ => Ok(()),
    }
}

pub fn should_fall_back(storage: KeyStorage, has_local_state: bool) -> bool {
    storage == KeyStorage::Os && !has_local_state
}

#[cfg(test)]
mod tests;
