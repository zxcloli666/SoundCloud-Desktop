use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use futures_util::FutureExt;
use sc_chat::store::MediaUpload;
use sc_chat::{ChatError, MediaKind, UploadState};
use uuid::Uuid;

use super::engine::Uploads;
use super::errors::{Outcome, Snag, backoff, outcome};

const IDLE_RECHECK: Duration = Duration::from_secs(30);
const QUICK_RETRIES: u32 = 3;
const ORPHAN_AGE: Duration = Duration::from_secs(3600);

impl Uploads {
    pub async fn run(self: Arc<Self>) {
        let mut seen_store = None;
        let mut failures = 0u32;
        let mut quick = 0u32;
        loop {
            let Some(store) = self.host.store() else {
                self.rest(IDLE_RECHECK).await;
                continue;
            };
            let key = Arc::as_ptr(&store) as usize;
            if seen_store != Some(key) {
                seen_store = Some(key);
                self.recover().await;
            }
            let upload = match self.blocking(|store| store.next_upload()).await {
                Ok(Some(upload)) => upload,
                Ok(None) => {
                    failures = 0;
                    self.apply_committed().await;
                    self.rest(IDLE_RECHECK).await;
                    continue;
                }
                Err(_) => {
                    failures += 1;
                    self.rest(backoff(failures)).await;
                    continue;
                }
            };
            let id = upload.id;
            let _ = self.wake.notified().now_or_never();
            match self.guarded(upload).await {
                Ok(()) => {
                    failures = 0;
                    quick = 0;
                }
                Err(Snag::Expired | Snag::Missing) if quick < QUICK_RETRIES => quick += 1,
                Err(snag) => {
                    quick = 0;
                    failures += 1;
                    if let Some(wait) = self.settle(id, snag).await {
                        self.rest(wait.max(backoff(failures))).await;
                    }
                }
            }
        }
    }

    async fn guarded(&self, upload: MediaUpload) -> Result<(), Snag> {
        if let Ok(mut current) = self.current.lock() {
            *current = Some(upload.id);
        }
        let stepped = tokio::select! {
            stepped = self.step(upload) => stepped,
            _ = self.stop.notified() => Ok(()),
        };
        if let Ok(mut current) = self.current.lock() {
            *current = None;
        }
        stepped
    }

    async fn settle(&self, id: Uuid, snag: Snag) -> Option<Duration> {
        let error = match snag {
            Snag::Failed(error) => error,
            Snag::Expired | Snag::Missing => ChatError::Offline,
        };
        let now = self.now();
        let mark =
            |retryable: bool| self.blocking(move |store| store.upload_failed(id, retryable, now));
        match outcome(&error) {
            Outcome::Retry => {
                let _ = mark(true).await;
                Some(Duration::ZERO)
            }
            Outcome::Later(wait) => {
                let _ = mark(true).await;
                self.host.failed(id, &error);
                Some(wait)
            }
            Outcome::Fatal => {
                let _ = mark(false).await;
                self.forget_targets(id);
                self.host.failed(id, &error);
                None
            }
            Outcome::Wait => Some(Duration::ZERO),
        }
    }

    async fn rest(&self, wait: Duration) {
        tokio::select! {
            _ = tokio::time::sleep(wait) => {}
            _ = self.wake.notified() => {}
        }
    }

    async fn recover(&self) {
        let Ok(uploads) = self.blocking(|store| store.uploads()).await else {
            return;
        };
        let keep: HashSet<String> = uploads.iter().flat_map(file_names).collect();
        for album in albums(uploads).into_values() {
            if album
                .iter()
                .all(|upload| upload.state == UploadState::Committed)
            {
                self.committed(&album[0]).await;
            }
        }
        self.files.sweep(keep, ORPHAN_AGE).await;
    }

    async fn apply_committed(&self) {
        let Ok(uploads) = self.blocking(|store| store.uploads()).await else {
            return;
        };
        let single = |upload: &&MediaUpload| {
            upload.kind != MediaKind::Image && upload.state == UploadState::Committed
        };
        for upload in uploads.iter().filter(single) {
            self.committed(upload).await;
        }
    }
}

pub fn file_names(upload: &MediaUpload) -> Vec<String> {
    let mut names = vec![upload.image_ref.clone()];
    names.extend(upload.thumb_ref.clone());
    names
}

fn albums(uploads: Vec<MediaUpload>) -> HashMap<Uuid, Vec<MediaUpload>> {
    let mut grouped: HashMap<Uuid, Vec<MediaUpload>> = HashMap::new();
    for upload in uploads {
        grouped.entry(upload.album).or_default().push(upload);
    }
    grouped
}
