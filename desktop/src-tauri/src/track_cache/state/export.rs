use std::path::{Path, PathBuf};
use std::time::Duration;

use super::{CacheRequest, TrackCacheState};
use crate::track_cache::transcode::{self, ExportFormat, ExportTags};

const MAX_COVER_BYTES: u64 = 8 * 1024 * 1024;
const CLEAN_WAIT_STEPS: u32 = 150;
const CLEAN_WAIT_STEP_MS: u64 = 200;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOutcome {
    pub path: String,
    pub skipped: bool,
}

pub(super) fn plain_file_name(name: &str) -> Option<&str> {
    let trimmed = name.trim();
    let bad = trimmed.is_empty()
        || trimmed == "."
        || trimmed == ".."
        || trimmed.contains(['/', '\\', ':'])
        || trimmed.chars().any(char::is_control);
    if bad || Path::new(trimmed).file_name().and_then(|n| n.to_str()) != Some(trimmed) {
        return None;
    }
    Some(trimmed)
}

impl TrackCacheState {
    async fn ensure_clean_for_export(&self, urn: &str, ffmpeg: &Path) -> Option<PathBuf> {
        if let Some(path) = self.resolve_clean_path(urn) {
            return Some(path);
        }
        let claimed = self
            .transcoding
            .lock()
            .ok()
            .map(|mut set| set.insert(urn.to_string()))
            .unwrap_or(false);
        if claimed {
            let _ = self.run_transcode(ffmpeg, urn).await;
            if let Ok(mut set) = self.transcoding.lock() {
                set.remove(urn);
            }
        } else {
            for _ in 0..CLEAN_WAIT_STEPS {
                if self.resolve_clean_path(urn).is_some() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(CLEAN_WAIT_STEP_MS)).await;
            }
        }
        self.resolve_clean_path(urn)
    }

    async fn fetch_cover(&self, url: &str) -> Option<Vec<u8>> {
        let resp = self.client.get(url).send().await.ok()?;
        if !resp.status().is_success() {
            return None;
        }
        if resp.content_length().is_some_and(|l| l > MAX_COVER_BYTES) {
            return None;
        }
        let bytes = resp.bytes().await.ok()?;
        if bytes.is_empty() || bytes.len() as u64 > MAX_COVER_BYTES {
            return None;
        }
        Some(bytes.to_vec())
    }

    pub async fn mp3_export_supported(&self) -> bool {
        let Some(ffmpeg) = self.ffmpeg() else {
            return false;
        };
        *self
            .mp3_encoder
            .get_or_init(|| transcode::has_mp3_encoder(&ffmpeg))
            .await
    }

    pub async fn export_track(
        &self,
        req: CacheRequest<'_>,
        dest: &Path,
        cover_url: Option<String>,
        format: ExportFormat,
        tags: &ExportTags,
    ) -> Result<(), String> {
        let urn = req.urn.to_string();
        let entry = self.ensure_cached(req).await?;
        let mut source_path = PathBuf::from(&entry.path);

        if let Some(ffmpeg) = self.ffmpeg() {
            if let Some(clean) = self.ensure_clean_for_export(&urn, &ffmpeg).await {
                source_path = clean;
            }
            if self.is_clean_path(&source_path) {
                let cover = match cover_url {
                    Some(u) if !u.is_empty() => self.fetch_cover(&u).await,
                    _ => None,
                };
                let result = transcode::export_with_cover(
                    &ffmpeg,
                    &source_path,
                    cover.as_deref(),
                    dest,
                    format,
                    tags,
                )
                .await;
                return match result {
                    Err(e) if cover.is_some() => {
                        eprintln!("[TrackCache] export with cover failed ({e}), retrying without");
                        transcode::export_with_cover(
                            &ffmpeg,
                            &source_path,
                            None,
                            dest,
                            format,
                            tags,
                        )
                        .await
                    }
                    other => other,
                };
            }
        }

        if format == ExportFormat::Mp3 {
            return Err("Cannot export to mp3: audio transcoder is unavailable".into());
        }
        let fallback = self.resolve_path(&urn).unwrap_or(source_path);
        if self.is_clean_path(&fallback) || transcode::is_m4a(&fallback).await {
            tokio::fs::copy(&fallback, dest)
                .await
                .map_err(|e| format!("Copy failed: {e}"))?;
            return Ok(());
        }
        Err("Cannot export to m4a: audio transcoder is still preparing or unavailable".into())
    }

    pub async fn export_to_dir(
        &self,
        req: CacheRequest<'_>,
        dir: &Path,
        file_name: &str,
        cover_url: Option<String>,
        format: ExportFormat,
        tags: &ExportTags,
    ) -> Result<ExportOutcome, String> {
        let name =
            plain_file_name(file_name).ok_or_else(|| format!("bad file name: {file_name}"))?;
        tokio::fs::create_dir_all(dir)
            .await
            .map_err(|e| format!("Cannot create folder: {e}"))?;
        let dest = dir.join(name);
        let path = dest.to_string_lossy().into_owned();
        let existing = tokio::fs::metadata(&dest)
            .await
            .map(|m| m.len())
            .unwrap_or(0);
        if existing > 0 {
            return Ok(ExportOutcome {
                path,
                skipped: true,
            });
        }
        self.export_track(req, &dest, cover_url, format, tags)
            .await?;
        Ok(ExportOutcome {
            path,
            skipped: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::plain_file_name;

    #[test]
    fn only_plain_file_names_pass() {
        assert_eq!(
            plain_file_name(" Artist - Song.m4a "),
            Some("Artist - Song.m4a")
        );
        for name in ["", "..", "a/b.m4a", "a\\b.m4a", "C:x.m4a", "x\n.m4a"] {
            assert_eq!(plain_file_name(name), None, "{name:?}");
        }
    }
}
