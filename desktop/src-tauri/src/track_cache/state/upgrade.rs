use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Instant;

use super::{
    CacheRequest, PlaybackQuality, RaceJob, TrackCacheEntry, TrackCacheState, is_valid_file,
    read_cache_metadata,
};

pub(super) fn upgrades_existing(existing: &Path, incoming: PlaybackQuality) -> bool {
    matches!(incoming, PlaybackQuality::Hq)
        && !matches!(
            read_cache_metadata(existing).map(|m| m.quality),
            Some(PlaybackQuality::Hq)
        )
}

impl TrackCacheState {
    pub async fn upgrade_cached(&self, req: CacheRequest<'_>) -> bool {
        let urn = req.urn;
        let Some(clean) = self.resolve_clean_path(urn) else {
            return false;
        };
        let entry = TrackCacheEntry::from_path_and_meta(&clean, read_cache_metadata(&clean));
        if entry.quality.as_deref() == Some("hq")
            || entry.accepted_short
            || self.ffmpeg().is_none()
            || is_valid_file(&self.incoming_file_path(urn))
            || !self.claim_upgrade(urn)
        {
            return false;
        }

        let Some(path) = self.download_hq(&req).await else {
            self.diag("INFO", format!("[TrackCache] no hq source to upgrade {urn}"));
            return false;
        };
        let served = read_cache_metadata(&path).map(|m| m.quality);
        if !matches!(served, Some(PlaybackQuality::Hq)) {
            self.remove_incoming(urn).await;
            self.diag("INFO", format!("[TrackCache] hq upgrade for {urn} served sq"));
            return false;
        }

        let liked = clean.starts_with(&self.liked_dir);
        self.finalize_incoming(&path, liked, req.expected_duration_ms.filter(|&ms| ms > 0))
            .await;
        self.spawn_transcode(urn.to_string());
        self.diag("INFO", format!("[TrackCache] upgrading {urn} to hq"));
        true
    }

    fn claim_upgrade(&self, urn: &str) -> bool {
        self.upgrade_attempts
            .lock()
            .is_ok_and(|mut set| set.insert(urn.to_string()))
    }

    async fn download_hq(&self, req: &CacheRequest<'_>) -> Option<PathBuf> {
        let start = Instant::now();
        let target_dir = self.incoming_dir.as_path();
        if matches!(
            PlaybackQuality::stored_as(req.storage_quality),
            PlaybackQuality::Hq
        ) {
            let storage =
                self.storage_job(target_dir, req.urn, req.storage_urls, PlaybackQuality::Hq, start);
            if let Some(path) = self.try_storage(&storage).await {
                return Some(path);
            }
        }
        if req.urls.is_empty() && req.download_urls.is_empty() {
            return None;
        }
        let job = RaceJob {
            target_dir,
            urn: req.urn,
            session_id: req.session_id,
            hq: true,
            start,
            receiving: Arc::new(AtomicBool::new(false)),
        };
        self.race_direct_and_api(&job, req.download_urls, req.urls)
            .await
            .ok()
    }
}
