use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use futures_util::FutureExt;
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, ChatResult, UploadState};
use uuid::Uuid;

use super::engine::Uploads;
use super::errors::{Outcome, Snag, backoff, outcome};
use super::schedule::{Rows, queued};

const IDLE_RECHECK: Duration = Duration::from_secs(30);
const QUICK_RETRIES: u32 = 3;
const REFUSALS_MAX: u32 = 6;
const ORPHAN_AGE: Duration = Duration::from_secs(3600);

impl Uploads {
    pub async fn run(self: Arc<Self>) {
        let mut seen_store = None;
        let mut rows = Rows::default();
        let mut failures = 0u32;
        loop {
            let Some(store) = self.host.store() else {
                self.rest(IDLE_RECHECK, &mut rows).await;
                continue;
            };
            let key = Arc::as_ptr(&store) as usize;
            if seen_store != Some(key) {
                seen_store = Some(key);
                rows = Rows::default();
                self.recover().await;
            }
            let Ok(queue) = self.blocking(queued).await else {
                failures += 1;
                self.rest(backoff(failures), &mut rows).await;
                continue;
            };
            let Some(upload) = rows.pick(&queue) else {
                self.settle_committed(queue.uploads).await;
                let wait = rows
                    .next_wake()
                    .map_or(IDLE_RECHECK, |at| at.min(IDLE_RECHECK));
                self.rest(wait, &mut rows).await;
                continue;
            };
            let _ = self.wake.notified().now_or_never();
            let id = upload.id;
            match self.guarded(upload).await {
                Ok(()) => {
                    failures = 0;
                    rows.ok(id);
                }
                Err(snag) => {
                    if let Some(wait) = self.snagged(id, snag, &mut rows).await {
                        failures += 1;
                        self.rest(wait.max(backoff(failures)), &mut rows).await;
                    }
                }
            }
        }
    }

    async fn guarded(&self, upload: MediaUpload) -> Result<(), Snag> {
        let stop = self.stop.notified();
        tokio::pin!(stop);
        stop.as_mut().enable();
        if let Ok(mut current) = self.current.lock() {
            *current = Some(upload.id);
        }
        let stepped = tokio::select! {
            stepped = self.step(upload) => stepped,
            _ = stop => Ok(()),
        };
        if let Ok(mut current) = self.current.lock() {
            *current = None;
        }
        stepped
    }

    async fn snagged(&self, id: Uuid, snag: Snag, rows: &mut Rows) -> Option<Duration> {
        let error = match snag {
            Snag::Failed(error) => error,
            Snag::Expired | Snag::Missing => {
                let refusals = rows.refused(id);
                if refusals > REFUSALS_MAX {
                    return self.fatal(id, refused(&snag), rows).await;
                }
                if refusals > QUICK_RETRIES {
                    let _ = self.mark(id, true).await;
                    rows.failed(id, Duration::ZERO);
                }
                return None;
            }
        };
        match outcome(&error) {
            Outcome::Retry => {
                if matches!(error, ChatError::Protocol) && rows.refused(id) > REFUSALS_MAX {
                    return self.fatal(id, error, rows).await;
                }
                let _ = self.mark(id, true).await;
                rows.failed(id, Duration::ZERO);
                None
            }
            Outcome::Later(wait) => {
                let _ = self.mark(id, true).await;
                self.host.failed(id, &error);
                rows.failed(id, wait);
                Some(wait)
            }
            Outcome::Fatal => self.fatal(id, error, rows).await,
            Outcome::Wait => Some(Duration::ZERO),
        }
    }

    async fn fatal(&self, id: Uuid, error: ChatError, rows: &mut Rows) -> Option<Duration> {
        if self.mark(id, false).await.is_err() {
            rows.failed(id, Duration::ZERO);
            return Some(Duration::ZERO);
        }
        rows.forget(id);
        self.forget_targets(id);
        self.host.failed(id, &error);
        None
    }

    async fn mark(&self, id: Uuid, retryable: bool) -> ChatResult<()> {
        let now = self.now();
        self.blocking(move |store| store.upload_failed(id, retryable, now))
            .await
    }

    async fn rest(&self, wait: Duration, rows: &mut Rows) {
        tokio::select! {
            _ = tokio::time::sleep(wait) => {}
            _ = self.wake.notified() => {}
        }
        if self.woken() {
            rows.wake();
        }
    }

    async fn recover(&self) {
        let Ok(uploads) = self.blocking(|store| store.uploads()).await else {
            return;
        };
        let keep: HashSet<String> = uploads.iter().flat_map(file_names).collect();
        self.settle_committed(uploads).await;
        self.files.sweep(keep, ORPHAN_AGE).await;
    }

    async fn settle_committed(&self, uploads: Vec<MediaUpload>) {
        for album in albums(uploads).into_values() {
            if album
                .iter()
                .all(|upload| upload.state == UploadState::Committed)
            {
                self.committed(&album[0]).await;
            }
        }
    }
}

pub fn file_names(upload: &MediaUpload) -> Vec<String> {
    let mut names = vec![upload.image_ref.clone()];
    names.extend(upload.thumb_ref.clone());
    names
}

fn refused(snag: &Snag) -> ChatError {
    match snag {
        Snag::Missing => ChatError::MediaMissing { ids: Vec::new() },
        _ => ChatError::Protocol,
    }
}

fn albums(uploads: Vec<MediaUpload>) -> HashMap<Uuid, Vec<MediaUpload>> {
    let mut grouped: HashMap<Uuid, Vec<MediaUpload>> = HashMap::new();
    for upload in uploads {
        grouped.entry(upload.album).or_default().push(upload);
    }
    grouped
}
