mod file;
mod os;

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use sc_chat::crypto::DeviceKeys;
use sc_chat::{ChatError, ChatResult, KeyName, KeyStorage, KeyStore, Zeroizing};

use super::runtime::database_path;
use crate::app::diagnostics;

use file::FileVault;
use os::OsVault;

const FALL_BACK_AFTER: u32 = 5;

pub trait Vault: Send + Sync {
    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>>;

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()>;

    fn delete(&self, name: KeyName) -> ChatResult<()>;
}

pub struct Keychain {
    os: Box<dyn Vault>,
    file: FileVault,
    database: PathBuf,
    storage: Mutex<KeyStorage>,
}

impl Keychain {
    pub fn new(service: &str, dir: &Path) -> Self {
        Self::with_os(Box::new(OsVault::new(service)), dir)
    }

    fn with_os(os: Box<dyn Vault>, dir: &Path) -> Self {
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
            storage: Mutex::new(storage),
        }
    }

    pub fn fall_back(&self) -> ChatResult<()> {
        self.file.create()?;
        self.set_storage(KeyStorage::File);
        diagnostics::warn("[chat] the os keychain is unavailable, chat keys moved to a 0600 file");
        Ok(())
    }

    pub fn wipe(&self) -> ChatResult<()> {
        let _one_at_a_time = DeviceKeys::exclusive();
        let vault = self.vault(self.storage());
        for name in KeyName::ALL {
            vault.delete(name)?;
        }
        Ok(())
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

    fn run<T>(&self, op: impl Fn(&dyn Vault) -> ChatResult<T>) -> ChatResult<T> {
        let storage = self.storage();
        match op(self.vault(storage)) {
            Err(ChatError::Keychain) if storage == KeyStorage::Os && !self.database.exists() => {
                self.fall_back()?;
                op(&self.file)
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

pub fn should_fall_back(storage: KeyStorage, has_local_state: bool, failures: u32) -> bool {
    storage == KeyStorage::Os && (!has_local_state || failures >= FALL_BACK_AFTER)
}

#[cfg(test)]
mod tests;
