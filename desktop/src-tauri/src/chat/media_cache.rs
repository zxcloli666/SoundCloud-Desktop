use std::path::{Path, PathBuf};

use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use super::download::MediaKey;

const DIR: &str = "media";

pub struct MediaCache {
    dir: PathBuf,
}

impl MediaCache {
    pub fn open(chat_dir: &Path) -> Self {
        Self {
            dir: chat_dir.join(DIR),
        }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn get(&self, _key: &MediaKey) -> ChatResult<Option<Vec<u8>>> {
        Ok(None)
    }

    pub fn put(&self, _key: &MediaKey, _ciphertext: &[u8]) -> ChatResult<()> {
        Err(ChatError::Unimplemented)
    }

    pub fn forget(&self, _media_id: Uuid) -> ChatResult<()> {
        Ok(())
    }

    pub fn size(&self) -> ChatResult<u64> {
        Ok(0)
    }

    pub fn clear(&self) -> ChatResult<u64> {
        Ok(0)
    }
}
