use std::sync::atomic::Ordering;

use tauri::Emitter;

use super::{CacheRequest, TrackCacheState};

const PROGRESS_EVENT: &str = "track:bulk-cache-progress";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCacheEntry {
    pub urn: String,
    pub urls: Vec<String>,
    #[serde(default)]
    pub download_urls: Vec<String>,
    #[serde(default)]
    pub storage_urls: Vec<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub hq: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub storage_quality: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCacheStatus {
    pub scope: String,
    pub total: u32,
    pub done: u32,
    pub failed: u32,
    pub skipped: u32,
}

enum Outcome {
    Cached,
    Skipped,
    Failed,
}

impl TrackCacheState {
    pub fn bulk_cache_status(&self) -> Option<BulkCacheStatus> {
        self.bulk_status.lock().ok().and_then(|s| s.clone())
    }

    pub fn cancel_bulk_cache(&self) {
        self.bulk_cancel.store(true, Ordering::Relaxed);
    }

    pub fn begin_bulk_cache(&self, scope: String, total: u32) -> Result<(), String> {
        let mut slot = self
            .bulk_status
            .lock()
            .map_err(|_| "bulk cache state poisoned".to_string())?;
        if let Some(running) = slot.as_ref() {
            return Err(format!("busy:{}", running.scope));
        }
        *slot = Some(BulkCacheStatus {
            scope,
            total,
            done: 0,
            failed: 0,
            skipped: 0,
        });
        self.bulk_cancel.store(false, Ordering::Relaxed);
        Ok(())
    }

    pub async fn run_bulk_cache(&self, entries: Vec<BulkCacheEntry>) -> Option<BulkCacheStatus> {
        let started = std::time::Instant::now();
        self.emit_bulk("start");

        let mut handles = Vec::with_capacity(entries.len());
        for entry in entries {
            if self.bulk_cancel.load(Ordering::Relaxed) {
                break;
            }
            if self.liked_has_file(&entry.urn) || self.promote_to_liked(&entry.urn).await {
                self.record_bulk(Outcome::Skipped);
                continue;
            }
            let Ok(permit) = self.bulk_limiter.clone().acquire_owned().await else {
                break;
            };
            let state = self.clone();
            handles.push(tokio::spawn(async move {
                let _permit = permit;
                if state.bulk_cancel.load(Ordering::Relaxed) {
                    return;
                }
                let outcome = match state.cache_bulk_entry(entry).await {
                    Ok(()) => Outcome::Cached,
                    Err(_) => Outcome::Failed,
                };
                state.record_bulk(outcome);
            }));
        }
        for handle in handles {
            let _ = handle.await;
        }

        let cancelled = self.bulk_cancel.swap(false, Ordering::Relaxed);
        self.emit_bulk(if cancelled { "cancelled" } else { "done" });
        let finished = self.bulk_status.lock().ok().and_then(|mut s| s.take());
        if let Some(status) = &finished {
            println!(
                "[TrackCache] bulk cache {} {} done={}/{} failed={} skipped={} in {}ms",
                status.scope,
                if cancelled { "cancelled" } else { "finished" },
                status.done,
                status.total,
                status.failed,
                status.skipped,
                started.elapsed().as_millis()
            );
        }
        finished
    }

    async fn cache_bulk_entry(&self, entry: BulkCacheEntry) -> Result<(), String> {
        self.ensure_cached(CacheRequest {
            urn: &entry.urn,
            urls: &entry.urls,
            download_urls: &entry.download_urls,
            storage_urls: &entry.storage_urls,
            session_id: entry.session_id.as_deref(),
            hq: entry.hq,
            storage_quality: entry.storage_quality.as_deref(),
            liked: true,
            expected_duration_ms: entry.duration_ms,
        })
        .await
        .map(|_| ())
    }

    fn record_bulk(&self, outcome: Outcome) {
        if let Ok(mut slot) = self.bulk_status.lock()
            && let Some(status) = slot.as_mut()
        {
            status.done += 1;
            match outcome {
                Outcome::Cached => {}
                Outcome::Skipped => status.skipped += 1,
                Outcome::Failed => status.failed += 1,
            }
        }
        self.emit_bulk("progress");
    }

    fn emit_bulk(&self, phase: &str) {
        let Some(app) = self.app_handle.as_ref() else {
            return;
        };
        let Some(status) = self.bulk_cache_status() else {
            return;
        };
        let _ = app.emit(
            PROGRESS_EVENT,
            serde_json::json!({
                "phase": phase,
                "scope": status.scope,
                "total": status.total,
                "done": status.done,
                "failed": status.failed,
                "skipped": status.skipped,
            }),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::super::tests::test_state;

    #[tokio::test]
    async fn second_bulk_run_is_refused_until_the_first_finishes() {
        let (root, state) = test_state("bulk-busy");
        state.begin_bulk_cache("playlist:1".into(), 0).unwrap();
        assert_eq!(
            state.begin_bulk_cache("likes".into(), 3),
            Err("busy:playlist:1".to_string())
        );
        assert_eq!(state.bulk_cache_status().unwrap().scope, "playlist:1");

        state.run_bulk_cache(Vec::new()).await;

        assert_eq!(state.bulk_cache_status(), None);
        assert!(state.begin_bulk_cache("likes".into(), 3).is_ok());
        std::fs::remove_dir_all(root).ok();
    }

    #[tokio::test]
    async fn already_saved_tracks_count_as_skipped() {
        let (root, state) = test_state("bulk-skip");
        let urn = "soundcloud:tracks:5";
        std::fs::write(
            state.liked_file_path(urn),
            vec![0u8; super::super::MIN_AUDIO_SIZE as usize],
        )
        .unwrap();
        state.begin_bulk_cache("album:a".into(), 1).unwrap();
        let entry = super::BulkCacheEntry {
            urn: urn.into(),
            urls: Vec::new(),
            download_urls: Vec::new(),
            storage_urls: Vec::new(),
            session_id: None,
            hq: false,
            duration_ms: None,
            storage_quality: None,
        };
        let finished = state.run_bulk_cache(vec![entry]).await.unwrap();
        assert_eq!(
            (finished.done, finished.skipped, finished.failed),
            (1, 1, 0)
        );
        assert_eq!(state.bulk_cache_status(), None);
        std::fs::remove_dir_all(root).ok();
    }
}
