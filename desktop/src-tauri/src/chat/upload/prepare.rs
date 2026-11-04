use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use sc_chat::media::{DECODE_THREADS, DECODE_TIMEOUT, MediaError, SOURCE_MAX_BYTES};
use sc_chat::{ChatError, ChatResult};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;

pub struct Prepare {
    slots: Arc<Semaphore>,
    timeout: Duration,
}

impl Default for Prepare {
    fn default() -> Self {
        Self {
            slots: Arc::new(Semaphore::new(DECODE_THREADS)),
            timeout: DECODE_TIMEOUT,
        }
    }
}

impl Prepare {
    pub async fn run<T, F>(&self, job: F) -> ChatResult<T>
    where
        T: Send + 'static,
        F: FnOnce() -> Result<T, MediaError> + Send + 'static,
    {
        let permit = tokio::time::timeout(self.timeout, self.slots.clone().acquire_owned())
            .await
            .map_err(|_| ChatError::NotReady)?
            .map_err(|_| ChatError::Internal)?;
        let work = tokio::task::spawn_blocking(move || {
            let _permit = permit;
            job()
        });
        match tokio::time::timeout(self.timeout, work).await {
            Ok(Ok(prepared)) => prepared.map_err(refused),
            Ok(Err(_)) => Err(ChatError::Invalid),
            Err(_) => Err(ChatError::NotReady),
        }
    }
}

pub async fn read_source(path: &Path) -> ChatResult<Vec<u8>> {
    let file = tokio::fs::File::open(path)
        .await
        .map_err(|_| ChatError::NotFound)?;
    let meta = file.metadata().await.map_err(|_| ChatError::NotFound)?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > SOURCE_MAX_BYTES as u64 {
        return Err(ChatError::Invalid);
    }
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    file.take(SOURCE_MAX_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .await
        .map_err(|_| ChatError::NotFound)?;
    checked_source(bytes)
}

pub fn checked_source(bytes: Vec<u8>) -> ChatResult<Vec<u8>> {
    match bytes.is_empty() || bytes.len() > SOURCE_MAX_BYTES {
        true => Err(ChatError::Invalid),
        false => Ok(bytes),
    }
}

fn refused(error: MediaError) -> ChatError {
    match error {
        MediaError::Busy | MediaError::TimedOut => ChatError::NotReady,
        MediaError::Cipher | MediaError::Random => ChatError::Crypto,
        _ => ChatError::Invalid,
    }
}
