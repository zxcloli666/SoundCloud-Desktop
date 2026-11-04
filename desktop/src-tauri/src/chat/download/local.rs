use std::path::{Path, PathBuf};
use std::sync::Arc;

use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, ChatResult};

use super::engine::Downloads;
use super::open::{self, Opened};
use super::{Fetched, MediaKey, Part};
use crate::chat::state::ChatState;

pub async fn upload(
    state: &ChatState,
    downloads: &Arc<Downloads>,
    key: MediaKey,
    part: Part,
) -> ChatResult<Fetched> {
    let core = state.core()?;
    let found = state
        .rt
        .spawn_blocking(move || core.store.upload(key.media_id))
        .await
        .map_err(|_| ChatError::Internal)??;
    match found {
        Some(upload) if upload.conversation_id == key.conversation_id => {
            downloads.local(upload, part).await
        }
        _ => Ok(Fetched::Lost),
    }
}

impl Downloads {
    pub async fn local(&self, upload: MediaUpload, part: Part) -> ChatResult<Fetched> {
        let (part, name) = match (part, upload.thumb_ref.as_deref()) {
            (Part::Thumb, Some(thumb)) => (Part::Thumb, thumb.to_owned()),
            _ => (Part::Image, upload.image_ref.clone()),
        };
        let Some(path) = file(&self.uploads, &name) else {
            return Ok(Fetched::Lost);
        };
        let Ok(cipher) = tokio::fs::read(&path).await else {
            return Ok(Fetched::Lost);
        };
        match open::sealed(self.worker.clone(), cipher, upload.attachment, part).await {
            Opened::Image(picture) => Ok(Fetched::Image(picture)),
            Opened::Busy => Err(ChatError::Busy { retry_ms: 1_000 }),
            Opened::Bad => Ok(Fetched::Lost),
        }
    }
}

fn file(dir: &Path, name: &str) -> Option<PathBuf> {
    let plain = !name.is_empty()
        && !name.starts_with('.')
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'.');
    plain.then(|| dir.join(name))
}
