use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use super::files::DIR;

pub const DELETES: &str = "deletes.json";
pub const ACCOUNTS_DIR: &str = "deletes";
const PART: &str = ".part";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Slot {
    Account(String),
    Store,
}

pub struct DeleteQueue {
    accounts: PathBuf,
    store: PathBuf,
    lock: Mutex<()>,
}

impl DeleteQueue {
    pub fn new(chat_dir: &Path) -> Self {
        Self {
            accounts: chat_dir.join(ACCOUNTS_DIR),
            store: chat_dir.join(DIR).join(DELETES),
            lock: Mutex::new(()),
        }
    }

    pub fn path(&self, slot: &Slot) -> PathBuf {
        match slot {
            Slot::Account(account) => self.accounts.join(format!("{}.json", hex(account))),
            Slot::Store => self.store.clone(),
        }
    }

    pub fn read(&self, slot: &Slot) -> Vec<Uuid> {
        let _held = self.lock.lock();
        self.load(slot)
    }

    pub fn add(&self, slot: &Slot, media: &[Uuid]) -> ChatResult<()> {
        let _held = self.lock.lock().map_err(|_| ChatError::Store)?;
        let mut pending = self.load(slot);
        let before = pending.len();
        for id in media {
            if !pending.contains(id) {
                pending.push(*id);
            }
        }
        if pending.len() == before {
            return Ok(());
        }
        self.save(slot, &pending)
    }

    pub fn settle(&self, slot: &Slot, done: &[Uuid]) -> ChatResult<()> {
        let _held = self.lock.lock().map_err(|_| ChatError::Store)?;
        let pending: Vec<Uuid> = self
            .load(slot)
            .into_iter()
            .filter(|id| !done.contains(id))
            .collect();
        self.save(slot, &pending)
    }

    pub fn adopt(&self, account: &str) -> ChatResult<()> {
        let _held = self.lock.lock().map_err(|_| ChatError::Store)?;
        let orphaned = self.load(&Slot::Store);
        if orphaned.is_empty() {
            return Ok(());
        }
        let slot = Slot::Account(account.to_string());
        let mut pending = self.load(&slot);
        for id in orphaned {
            if !pending.contains(&id) {
                pending.push(id);
            }
        }
        self.save(&slot, &pending)?;
        self.save(&Slot::Store, &[])
    }

    fn load(&self, slot: &Slot) -> Vec<Uuid> {
        fs::read(self.path(slot))
            .ok()
            .and_then(|listed| serde_json::from_slice(&listed).ok())
            .unwrap_or_default()
    }

    fn save(&self, slot: &Slot, pending: &[Uuid]) -> ChatResult<()> {
        let path = self.path(slot);
        if pending.is_empty() {
            return match fs::remove_file(&path) {
                Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(ChatError::Store),
                _ => Ok(()),
            };
        }
        let listed = serde_json::to_vec(pending).map_err(|_| ChatError::Store)?;
        write_atomic(&path, &listed).map_err(|_| ChatError::Store)
    }
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let dir = path.parent().ok_or(std::io::ErrorKind::InvalidInput)?;
    fs::create_dir_all(dir)?;
    let mut part = path.as_os_str().to_owned();
    part.push(PART);
    let part = PathBuf::from(part);
    let written = (|| {
        let mut file = fs::File::create(&part)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&part, path)
    })();
    if written.is_err() {
        let _ = fs::remove_file(&part);
    }
    written
}

fn hex(account: &str) -> String {
    account.bytes().map(|byte| format!("{byte:02x}")).collect()
}
