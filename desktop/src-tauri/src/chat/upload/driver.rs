use std::collections::HashSet;
use std::sync::{Arc, Weak};
use std::time::Duration;

use futures_util::FutureExt;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{ChatError, ChatResult};
use uuid::Uuid;

use super::delete_queue::DELETES;
use super::engine::Uploads;
use super::errors::{Outcome, Snag, backoff, outcome};
use super::post::finish_renewals;
use super::schedule::{Queue, Rows, queued};

const IDLE_RECHECK: Duration = Duration::from_secs(30);
const STAGE_PAUSE: Duration = Duration::from_secs(20);
const QUICK_RETRIES: u32 = 3;
const REFUSALS_MAX: u32 = 6;
const ORPHAN_AGE: Duration = Duration::from_secs(3600);

impl Uploads {
    pub async fn run(self: Arc<Self>) {
        let mut seen: Weak<Store> = Weak::new();
        let mut rows = Rows::default();
        let mut failures = 0u32;
        loop {
            let Some(store) = self.live_store() else {
                self.rest(IDLE_RECHECK, &mut rows).await;
                continue;
            };
            let fresh = !Weak::ptr_eq(&seen, &Arc::downgrade(&store));
            if fresh {
                seen = Arc::downgrade(&store);
            }
            drop(store);
            if fresh {
                rows = Rows::default();
                self.recover().await;
            }
            if self.woken() {
                rows.wake();
            }
            let Ok(queue) = self.queue().await else {
                failures += 1;
                self.rest(backoff(failures), &mut rows).await;
                continue;
            };
            let Some(upload) = rows.pick(&queue) else {
                self.settle(queue.settle).await;
                self.retry_deletes().await;
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
        if self.live_store().is_none() {
            return Ok(());
        }
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
                if self.holds_stage(id).await {
                    rows.hold(id, STAGE_PAUSE);
                }
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

    async fn holds_stage(&self, id: Uuid) -> bool {
        let found = self.blocking(move |store| store.upload(id)).await;
        found.is_ok_and(|upload| upload.is_some_and(|upload| upload.stage_id.is_some()))
    }

    async fn queue(&self) -> ChatResult<Queue> {
        let now = self.now();
        self.blocking(move |store| queued(store, now)).await
    }

    async fn recover(&self) {
        if self.blocking(finish_renewals).await.is_err() {
            return;
        }
        let Ok(queue) = self.queue().await else {
            return;
        };
        let mut keep: HashSet<String> = queue.uploads.iter().flat_map(file_names).collect();
        keep.insert(DELETES.to_string());
        self.settle(queue.settle).await;
        self.retry_deletes().await;
        self.files.sweep(keep, ORPHAN_AGE).await;
    }

    async fn settle(&self, settle: Vec<MediaUpload>) {
        for upload in settle {
            self.committed(&upload).await;
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
