use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use bytes::Bytes;
use futures_util::Stream;
use serde::Serialize;
use tauri::Emitter;
use tokio::io::AsyncReadExt;

use crate::rt::AppHandle;

const CHUNK_BYTES: usize = 256 * 1024;
const EMIT_EVERY: Duration = Duration::from_millis(200);
pub const PROGRESS_EVENT: &str = "track-upload:progress";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress<'a> {
    id: &'a str,
    sent: u64,
    total: u64,
}

pub struct Reporter {
    app: AppHandle,
    id: String,
    total: u64,
    cancel: Arc<AtomicBool>,
}

impl Reporter {
    pub fn new(app: AppHandle, id: String, total: u64, cancel: Arc<AtomicBool>) -> Self {
        Self {
            app,
            id,
            total,
            cancel,
        }
    }

    pub fn emit(&self, sent: u64) {
        let _ = self.app.emit(
            PROGRESS_EVENT,
            Progress {
                id: &self.id,
                sent,
                total: self.total,
            },
        );
    }
}

struct ReadState {
    file: tokio::fs::File,
    reporter: Arc<Reporter>,
    sent: u64,
    emitted_at: Instant,
}

pub fn file_stream(
    file: tokio::fs::File,
    reporter: Arc<Reporter>,
) -> impl Stream<Item = std::io::Result<Bytes>> + Send + 'static {
    let state = ReadState {
        file,
        reporter,
        sent: 0,
        emitted_at: Instant::now(),
    };
    futures_util::stream::try_unfold(state, |mut state| async move {
        if state.reporter.cancel.load(Ordering::Relaxed) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "upload cancelled",
            ));
        }
        let mut buffer = vec![0u8; CHUNK_BYTES];
        let read = state.file.read(&mut buffer).await?;
        if read == 0 {
            state.reporter.emit(state.sent);
            return Ok(None);
        }
        buffer.truncate(read);
        state.sent += read as u64;
        if state.emitted_at.elapsed() >= EMIT_EVERY {
            state.emitted_at = Instant::now();
            state.reporter.emit(state.sent);
        }
        Ok(Some((Bytes::from(buffer), state)))
    })
}
