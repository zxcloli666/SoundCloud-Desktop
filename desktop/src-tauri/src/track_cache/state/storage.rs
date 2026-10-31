use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::app::diagnostics;
use crate::network::dns;
use crate::network::netcheck::model::Role;

use super::{
    DownloadError, DownloadSource, PlaybackQuality, STORAGE_COOLDOWN_AFTER, STORAGE_COOLDOWN_SECS,
    TrackCacheState, file_len, host_of, write_response_to_cache,
};


#[derive(Default)]
pub(super) struct StorageCooldown {
    fails: u8,
    last_at: u64,
    dns_epoch: u64,
}

impl StorageCooldown {
    pub(super) fn failed(&mut self, now: u64, dns_epoch: u64) {
        if dns_epoch != self.dns_epoch || now.saturating_sub(self.last_at) >= STORAGE_COOLDOWN_SECS
        {
            self.fails = 0;
        }
        self.fails = self.fails.saturating_add(1);
        self.last_at = now;
        self.dns_epoch = dns_epoch;
    }

    pub(super) fn cooling(&self, now: u64, dns_epoch: u64) -> bool {
        dns_epoch == self.dns_epoch
            && self.fails >= STORAGE_COOLDOWN_AFTER
            && now.saturating_sub(self.last_at) < STORAGE_COOLDOWN_SECS
    }
}

enum Streamed {
    Saved(PathBuf),
    Answered,
    Unreachable,
}

pub(super) struct StorageJob<'a> {
    pub target_dir: &'a Path,
    pub urn: &'a str,
    pub urls: Vec<&'a String>,
    pub quality: PlaybackQuality,
    pub start: Instant,
}

impl TrackCacheState {
    pub(super) fn storage_job<'a>(
        &self,
        target_dir: &'a Path,
        urn: &'a str,
        storage_urls: &'a [String],
        quality: PlaybackQuality,
        start: Instant,
    ) -> StorageJob<'a> {
        let mut urls: Vec<&String> = storage_urls.iter().collect();
        urls.sort_by_key(|url| {
            let healthy = host_of(url)
                .map(|h| self.storage_host_available(&h))
                .unwrap_or(true);
            u8::from(!healthy)
        });
        StorageJob {
            target_dir,
            urn,
            urls,
            quality,
            start,
        }
    }

    pub(super) async fn try_storage_stream(&self, job: &StorageJob<'_>) -> Option<PathBuf> {
        for storage_url in &job.urls {
            let Some(host) = host_of(storage_url) else {
                continue;
            };
            if !self.storage_host_available(&host) {
                continue;
            }
            let mut epoch = dns::epoch();
            let mut streamed = self.stream_hops(job, storage_url, &host).await;
            if matches!(streamed, Streamed::Unreachable) && dns::changed_since(&host, epoch).await {
                epoch = dns::epoch();
                streamed = self.stream_hops(job, storage_url, &host).await;
            }
            match streamed {
                Streamed::Saved(path) => return Some(path),
                Streamed::Unreachable => self.mark_storage_host_failed(&host, epoch),
                Streamed::Answered => {}
            }
        }
        None
    }

    async fn stream_hops(&self, job: &StorageJob<'_>, storage_url: &str, host: &str) -> Streamed {
        let urn = job.urn;
        let mut transport_ok = false;
        let hops = crate::network::edge::plan(storage_url);
        for (index, hop) in hops.into_iter().enumerate() {
            let sent = self.storage_get(&hop, Role::of_index(index)).await;
            let resp = match sent {
                Ok(r) => r,
                Err(fail) => {
                    hop.note(false);
                    diagnostics::warn(format!("[TrackCache] storage {} failed for {urn}: {fail}", hop.tier_label()));
                    continue;
                }
            };
            if !crate::network::edge::hop_ok(&hop, &resp) {
                continue;
            }
            transport_ok = true;
            hop.note(resp.status().as_u16() < 500);

            let status = resp.status();
            if status.is_success() {
                self.mark_storage_host_ok(host);
                println!("[TrackCache] {urn} → storage stream ({host} via {})", hop.tier_label());
                match write_response_to_cache(
                    job.target_dir,
                    urn,
                    resp,
                    job.quality,
                    DownloadSource::Storage,
                    self.app_handle.as_ref(),
                )
                .await
                {
                    Ok(result) => {
                        let bytes = file_len(&result.path);
                        hop.note_delivered(bytes);
                        let kb = bytes / 1024;
                        let ms = job.start.elapsed().as_millis();
                        println!(
                            "[TrackCache] downloaded {urn} via storage stream — {kb} KB in {ms}ms"
                        );
                        return Streamed::Saved(result.path);
                    }
                    Err(DownloadError::Fatal(e)) => {
                        diagnostics::warn(format!("[TrackCache] storage write failed for {urn}: {e}"));
                    }
                    Err(DownloadError::Retryable(e)) => {
                        hop.note(false);
                        diagnostics::warn(format!("[TrackCache] storage download failed for {urn}: {e}"));
                    }
                }
            } else if matches!(status.as_u16(), 404 | 410) {
                break;
            } else {
                diagnostics::warn(format!("[TrackCache] storage HTTP {status} for {urn} ({host})"));
            }
        }
        if transport_ok {
            Streamed::Answered
        } else {
            Streamed::Unreachable
        }
    }
}

#[cfg(test)]
mod tests {
    use super::StorageCooldown;

    #[test]
    fn one_failed_attempt_does_not_cool_the_host() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        assert!(!cooldown.cooling(1_000, 0));
    }

    #[test]
    fn two_failed_attempts_cool_it_for_a_minute() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        cooldown.failed(1_010, 0);
        assert!(cooldown.cooling(1_010, 0));
        assert!(cooldown.cooling(1_069, 0));
    }

    #[test]
    fn an_old_failure_does_not_count() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        cooldown.failed(1_060, 0);
        assert!(!cooldown.cooling(1_060, 0));
        cooldown.failed(1_061, 0);
        assert!(cooldown.cooling(1_061, 0));
    }

    #[test]
    fn cooling_ends_after_the_window() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        cooldown.failed(1_001, 0);
        assert!(!cooldown.cooling(1_061, 0));
    }

    #[test]
    fn a_new_dns_answer_lifts_the_cooldown() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        cooldown.failed(1_000, 0);
        assert!(cooldown.cooling(1_000, 0));
        assert!(!cooldown.cooling(1_000, 1));
    }

    #[test]
    fn failures_under_an_older_dns_answer_do_not_add_up() {
        let mut cooldown = StorageCooldown::default();
        cooldown.failed(1_000, 0);
        cooldown.failed(1_001, 1);
        assert!(!cooldown.cooling(1_001, 1));
        cooldown.failed(1_002, 1);
        assert!(cooldown.cooling(1_002, 1));
    }
}
