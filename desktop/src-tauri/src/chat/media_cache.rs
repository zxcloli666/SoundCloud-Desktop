mod index;

use std::fs::{self, File, FileTimes};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::SystemTime;

use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use self::index::Index;
use super::download::Part;

const DIR: &str = "media";
const TMP: &str = "tmp";
pub const CAP: u64 = 1024 * 1024 * 1024;

pub struct MediaCache {
    chat_dir: PathBuf,
    dir: PathBuf,
    cap: u64,
    index: Mutex<Index>,
}

impl MediaCache {
    pub fn open(chat_dir: &Path) -> Self {
        Self::with_cap(chat_dir, CAP)
    }

    pub fn with_cap(chat_dir: &Path, cap: u64) -> Self {
        Self {
            chat_dir: chat_dir.to_path_buf(),
            dir: chat_dir.join(DIR),
            cap,
            index: Mutex::new(Index::default()),
        }
    }

    #[cfg(test)]
    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn chat_dir(&self) -> &Path {
        &self.chat_dir
    }

    pub fn get(&self, media_id: Uuid, part: Part) -> ChatResult<Option<Vec<u8>>> {
        let name = name(media_id, part);
        if !self.index()?.has(&name) {
            return Ok(None);
        }
        let path = self.dir.join(&name);
        match fs::read(&path) {
            Ok(bytes) => {
                let now = SystemTime::now();
                touch(&path, now);
                self.index()?.used(&name, now);
                Ok(Some(bytes))
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                self.index()?.remove(&name);
                Ok(None)
            }
            Err(_) => Ok(None),
        }
    }

    pub fn put(&self, media_id: Uuid, part: Part, ciphertext: &[u8]) -> ChatResult<()> {
        let name = name(media_id, part);
        drop(self.index()?);
        fs::create_dir_all(&self.dir).map_err(|_| ChatError::Store)?;
        let tmp = self
            .dir
            .join(format!("{name}.{}.{TMP}", Uuid::new_v4().simple()));
        if write(&tmp, ciphertext).is_err() {
            let _ = fs::remove_file(&tmp);
            return Err(ChatError::Store);
        }
        let mut index = self.index()?;
        if fs::rename(&tmp, self.dir.join(&name)).is_err() {
            let _ = fs::remove_file(&tmp);
            return Err(ChatError::Store);
        }
        index.insert(name.clone(), ciphertext.len() as u64, SystemTime::now());
        for evicted in index.evict(self.cap, &name) {
            let _ = fs::remove_file(self.dir.join(evicted));
        }
        Ok(())
    }

    pub fn drop_part(&self, media_id: Uuid, part: Part) -> ChatResult<()> {
        let name = name(media_id, part);
        self.index()?.remove(&name);
        let _ = fs::remove_file(self.dir.join(name));
        Ok(())
    }

    pub fn forget(&self, media_id: Uuid) -> ChatResult<()> {
        let mut index = self.index()?;
        for part in [Part::Thumb, Part::Image] {
            let name = name(media_id, part);
            index.remove(&name);
            let _ = fs::remove_file(self.dir.join(name));
        }
        Ok(())
    }

    pub fn size(&self) -> ChatResult<u64> {
        Ok(self.index()?.total())
    }

    pub fn clear(&self) -> ChatResult<u64> {
        let mut index = self.index()?;
        let freed = index.total();
        for name in index.names() {
            let _ = fs::remove_file(self.dir.join(name));
        }
        *index = Index::empty();
        Ok(freed)
    }

    fn index(&self) -> ChatResult<MutexGuard<'_, Index>> {
        let mut index = self.index.lock().map_err(|_| ChatError::Store)?;
        if !index.loaded() {
            *index = Index::scan(&self.dir, TMP);
        }
        Ok(index)
    }
}

pub fn name(media_id: Uuid, part: Part) -> String {
    format!("{}.{}", media_id.simple(), part.label())
}

fn write(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    File::create(path)?.write_all(bytes)
}

fn touch(path: &Path, at: SystemTime) {
    if let Ok(file) = File::options().write(true).open(path) {
        let _ = file.set_times(FileTimes::new().set_modified(at));
    }
}

#[cfg(test)]
mod tests;
