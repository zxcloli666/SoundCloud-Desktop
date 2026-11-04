use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use sc_chat::{ChatError, ChatResult};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

const DIR: &str = "uploads";
const PART: &str = ".part";
pub const IMAGE: &str = "img";
pub const THUMB: &str = "thumb";

pub struct Files {
    dir: PathBuf,
}

impl Files {
    pub fn new(chat_dir: &Path) -> Self {
        Self {
            dir: chat_dir.join(DIR),
        }
    }

    pub async fn write(&self, kind: &str, bytes: &[u8]) -> ChatResult<String> {
        let name = format!("{}.{kind}", Uuid::new_v4().simple());
        let path = self.path(&name)?;
        let part = self.dir.join(format!("{name}{PART}"));
        tokio::fs::create_dir_all(&self.dir)
            .await
            .map_err(|_| ChatError::Store)?;
        let written = async {
            let mut file = tokio::fs::File::create(&part).await?;
            file.write_all(bytes).await?;
            file.sync_all().await?;
            tokio::fs::rename(&part, &path).await
        };
        if written.await.is_err() {
            let _ = tokio::fs::remove_file(&part).await;
            return Err(ChatError::Store);
        }
        Ok(name)
    }

    pub async fn read(&self, name: &str, size: u64) -> ChatResult<Vec<u8>> {
        let bytes = tokio::fs::read(self.path(name)?)
            .await
            .map_err(|_| ChatError::Store)?;
        if bytes.len() as u64 != size {
            return Err(ChatError::Store);
        }
        Ok(bytes)
    }

    pub async fn remove(&self, names: Vec<String>) {
        for name in names {
            if let Ok(path) = self.path(&name) {
                let _ = tokio::fs::remove_file(path).await;
            }
        }
    }

    pub async fn sweep(&self, keep: HashSet<String>, older_than: Duration) {
        let Ok(mut entries) = tokio::fs::read_dir(&self.dir).await else {
            return;
        };
        let cutoff = SystemTime::now().checked_sub(older_than);
        while let Ok(Some(entry)) = entries.next_entry().await {
            let name = entry.file_name().to_string_lossy().into_owned();
            if keep.contains(&name) {
                continue;
            }
            let modified = entry.metadata().await.and_then(|meta| meta.modified());
            let old = match (modified, cutoff) {
                (Ok(at), Some(cutoff)) => at < cutoff,
                _ => false,
            };
            if old {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
    }

    fn path(&self, name: &str) -> ChatResult<PathBuf> {
        let plain = !name.is_empty()
            && name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'.')
            && !name.starts_with('.');
        match plain {
            true => Ok(self.dir.join(name)),
            false => Err(ChatError::Invalid),
        }
    }
}
