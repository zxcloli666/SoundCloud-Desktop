use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::network::edge::Tier;

use super::{
    DownloadError, DownloadSource, PRESIGN_ORIGIN, PlaybackQuality, TrackCacheState, file_len,
    host_of, make_redirect_url, write_response_to_cache,
};

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

    pub(super) async fn try_storage(&self, job: &StorageJob<'_>) -> Option<PathBuf> {
        match self.try_storage_redirect(job).await {
            Some(path) => Some(path),
            None => self.try_storage_stream(job).await,
        }
    }

    pub(super) async fn try_storage_redirect(&self, job: &StorageJob<'_>) -> Option<PathBuf> {
        let urn = job.urn;
        for storage_url in &job.urls {
            let Some(host) = host_of(storage_url) else {
                continue;
            };
            if !crate::network::edge::is_direct(storage_url)
                || !crate::network::edge::direct_first(PRESIGN_ORIGIN)
            {
                continue;
            }
            let Some(redirect_url) = make_redirect_url(storage_url) else {
                continue;
            };

            match self.presigned_get(&redirect_url).await {
                Ok(resp) if resp.status().is_success() => {
                    let landed = resp.url().to_string();
                    println!("[TrackCache] {urn} → storage (redirect via {host})");
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
                            crate::network::edge::note_url_delivered(&landed, Tier::Direct, bytes);
                            let kb = bytes / 1024;
                            let ms = job.start.elapsed().as_millis();
                            println!("[TrackCache] downloaded {urn} via s3 — {kb} KB in {ms}ms");
                            return Some(result.path);
                        }
                        Err(DownloadError::Fatal(e)) => {
                            eprintln!("[TrackCache] s3 write failed for {urn}: {e}");
                        }
                        Err(DownloadError::Retryable(e)) => {
                            crate::network::edge::note_url(&landed, Tier::Direct, false);
                            eprintln!("[TrackCache] s3 download failed for {urn}: {e}");
                        }
                    }
                }
                Ok(resp) if resp.status().as_u16() == 404 || resp.status().as_u16() == 410 => {}
                Ok(resp) => {
                    eprintln!(
                        "[TrackCache] s3 redirect HTTP {} for {urn} ({host})",
                        resp.status()
                    );
                }
                Err(err) => {
                    eprintln!("[TrackCache] s3 redirect failed for {urn} ({host}): {err}");
                }
            }
        }
        None
    }

    pub(super) async fn try_storage_stream(&self, job: &StorageJob<'_>) -> Option<PathBuf> {
        let urn = job.urn;
        for storage_url in &job.urls {
            let Some(host) = host_of(storage_url) else {
                continue;
            };
            if !self.storage_host_available(&host) {
                continue;
            }

            let mut transport_ok = false;
            for hop in crate::network::edge::plan(storage_url) {
                let resp = match self.storage_get(&hop).await {
                    Ok(r) => r,
                    Err(err) => {
                        hop.note(false);
                        eprintln!("[TrackCache] storage {} failed for {urn}: {err}", hop.tier_label());
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
                    self.mark_storage_host_ok(&host);
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
                            return Some(result.path);
                        }
                        Err(DownloadError::Fatal(e)) => {
                            eprintln!("[TrackCache] storage write failed for {urn}: {e}");
                        }
                        Err(DownloadError::Retryable(e)) => {
                            hop.note(false);
                            eprintln!("[TrackCache] storage download failed for {urn}: {e}");
                        }
                    }
                } else if matches!(status.as_u16(), 404 | 410) {
                    break;
                } else {
                    eprintln!("[TrackCache] storage HTTP {status} for {urn} ({host})");
                }
            }

            if !transport_ok {
                self.mark_storage_host_failed(&host);
            }
        }
        None
    }
}
