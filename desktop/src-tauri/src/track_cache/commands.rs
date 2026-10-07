use std::path::Path;

use tauri::State;

use crate::shared::blocking::run_blocking;
use crate::shared::urn::canonical_track_urn;
use crate::track_cache::state::{
    BulkCacheEntry, BulkCacheStatus, CacheInventoryEntry, CacheRequest, ExportOutcome,
    TrackCacheEntry, TrackCacheState, TranscodeStatus,
};
use crate::track_cache::transcode::{ExportFormat, ExportTags};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureCachedRequest {
    pub urn: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub urls: Option<Vec<String>>,
    #[serde(default)]
    pub download_urls: Option<Vec<String>>,
    #[serde(default)]
    pub storage_urls: Option<Vec<String>>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub hq: bool,
    /// API-reported track length (ms) for truncated-download detection.
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub storage_quality: Option<String>,
}

fn require_track_urn(urn: &str) -> Result<String, String> {
    canonical_track_urn(urn).ok_or_else(|| format!("invalid track urn: {urn}"))
}

impl EnsureCachedRequest {
    /// Resolve the ordered `/stream` fallback URLs (`urls` preferred, else `url`).
    fn fallback_urls(&self) -> Option<Vec<String>> {
        match (&self.urls, &self.url) {
            (Some(u), _) if !u.is_empty() => Some(u.clone()),
            (_, Some(u)) => Some(vec![u.clone()]),
            _ => None,
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreloadEntry {
    pub urn: String,
    pub url: Option<String>,
    pub urls: Option<Vec<String>>,
    #[serde(default)]
    pub download_urls: Option<Vec<String>>,
    pub storage_urls: Option<Vec<String>>,
    pub session_id: Option<String>,
    #[serde(default)]
    pub hq: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub storage_quality: Option<String>,
}

#[tauri::command]
pub async fn track_ensure_cached(
    request: EnsureCachedRequest,
    state: State<'_, TrackCacheState>,
) -> Result<TrackCacheEntry, String> {
    let urn = require_track_urn(&request.urn)?;
    let fallback_urls = request
        .fallback_urls()
        .ok_or_else(|| "no stream URL provided".to_string())?;
    let storage_urls = request.storage_urls.unwrap_or_default();
    let download_urls = request.download_urls.unwrap_or_default();
    state
        .ensure_cached(CacheRequest {
            urn: &urn,
            urls: &fallback_urls,
            download_urls: &download_urls,
            storage_urls: &storage_urls,
            session_id: request.session_id.as_deref(),
            hq: request.hq,
            storage_quality: request.storage_quality.as_deref(),
            liked: false,
            expected_duration_ms: request.duration_ms,
        })
        .await
}

struct ResolvedRequest {
    urn: String,
    urls: Vec<String>,
    download_urls: Vec<String>,
    storage_urls: Vec<String>,
    request: EnsureCachedRequest,
}

impl ResolvedRequest {
    fn new(request: EnsureCachedRequest) -> Result<Self, String> {
        Ok(Self {
            urn: require_track_urn(&request.urn)?,
            urls: request
                .fallback_urls()
                .ok_or_else(|| "no stream URL provided".to_string())?,
            download_urls: request.download_urls.clone().unwrap_or_default(),
            storage_urls: request.storage_urls.clone().unwrap_or_default(),
            request,
        })
    }

    fn cache_request(&self, liked: bool) -> CacheRequest<'_> {
        CacheRequest {
            urn: &self.urn,
            urls: &self.urls,
            download_urls: &self.download_urls,
            storage_urls: &self.storage_urls,
            session_id: self.request.session_id.as_deref(),
            hq: self.request.hq,
            storage_quality: self.request.storage_quality.as_deref(),
            liked,
            expected_duration_ms: self.request.duration_ms,
        }
    }
}

#[tauri::command]
pub async fn track_export(
    request: EnsureCachedRequest,
    dest_path: String,
    cover_url: Option<String>,
    format: Option<ExportFormat>,
    tags: Option<ExportTags>,
    state: State<'_, TrackCacheState>,
) -> Result<String, String> {
    let resolved = ResolvedRequest::new(request)?;
    state
        .export_track(
            resolved.cache_request(false),
            Path::new(&dest_path),
            cover_url,
            format.unwrap_or(ExportFormat::M4a),
            &tags.unwrap_or_default(),
        )
        .await?;
    Ok(dest_path)
}

#[tauri::command]
pub async fn track_export_to_dir(
    request: EnsureCachedRequest,
    dir: String,
    file_name: String,
    cover_url: Option<String>,
    format: ExportFormat,
    tags: ExportTags,
    state: State<'_, TrackCacheState>,
) -> Result<ExportOutcome, String> {
    let resolved = ResolvedRequest::new(request)?;
    state
        .export_to_dir(
            resolved.cache_request(false),
            Path::new(&dir),
            &file_name,
            cover_url,
            format,
            &tags,
        )
        .await
}

#[tauri::command]
pub async fn track_export_mp3_supported(state: State<'_, TrackCacheState>) -> Result<bool, String> {
    Ok(state.mp3_export_supported().await)
}

#[tauri::command]
pub async fn track_save_offline(
    request: EnsureCachedRequest,
    refetch: bool,
    state: State<'_, TrackCacheState>,
) -> Result<TrackCacheEntry, String> {
    let resolved = ResolvedRequest::new(request)?;
    state
        .save_offline(resolved.cache_request(true), refetch)
        .await
}

#[tauri::command]
pub fn track_pinned_urns(urns: Vec<String>, state: State<'_, TrackCacheState>) -> Vec<String> {
    urns.into_iter()
        .filter(|urn| canonical_track_urn(urn).is_some_and(|urn| state.is_pinned(&urn)))
        .collect()
}

#[tauri::command]
pub fn track_mark_played(urn: String, state: State<'_, TrackCacheState>) {
    if let Some(urn) = canonical_track_urn(&urn) {
        state.mark_played(&urn);
    }
}

#[tauri::command]
pub fn track_is_cached(urn: String, state: State<'_, TrackCacheState>) -> bool {
    canonical_track_urn(&urn).is_some_and(|urn| state.is_cached(&urn))
}

#[tauri::command]
pub fn track_transcode_status(state: State<'_, TrackCacheState>) -> TranscodeStatus {
    state.transcode_status()
}

#[tauri::command]
pub fn track_get_cache_path(urn: String, state: State<'_, TrackCacheState>) -> Option<String> {
    canonical_track_urn(&urn).and_then(|urn| state.get_cache_path(&urn))
}

#[tauri::command]
pub fn track_get_cache_info(
    urn: String,
    state: State<'_, TrackCacheState>,
) -> Option<TrackCacheEntry> {
    canonical_track_urn(&urn).and_then(|urn| state.get_cache_entry(&urn))
}

#[tauri::command]
pub async fn track_preload(
    entries: Vec<PreloadEntry>,
    state: State<'_, TrackCacheState>,
) -> Result<(), String> {
    let mut queued = 0u32;
    for entry in entries {
        let Some(urn) = canonical_track_urn(&entry.urn) else {
            continue;
        };
        if state.is_cached(&urn) {
            continue;
        }

        let Some(permit) = state.try_acquire_preload_slot() else {
            continue;
        };

        queued += 1;
        let state = state.inner().clone();
        let fallback_urls: Vec<String> = match (entry.urls, entry.url) {
            (Some(u), _) if !u.is_empty() => u,
            (_, Some(u)) => vec![u],
            _ => continue,
        };
        let storage_urls = entry.storage_urls.unwrap_or_default();
        let download_urls = entry.download_urls.unwrap_or_default();
        let session_id = entry.session_id;
        let hq = entry.hq;
        let duration_ms = entry.duration_ms;
        let storage_quality = entry.storage_quality;

        tokio::spawn(async move {
            let _permit = permit;
            println!("[TrackCache] preloading {urn}");
            if let Err(err) = state
                .ensure_cached(CacheRequest {
                    urn: &urn,
                    urls: &fallback_urls,
                    download_urls: &download_urls,
                    storage_urls: &storage_urls,
                    session_id: session_id.as_deref(),
                    hq,
                    storage_quality: storage_quality.as_deref(),
                    liked: false,
                    expected_duration_ms: duration_ms,
                })
                .await
            {
                eprintln!("[TrackCache] preload {urn}: {err}");
            }
        });
    }
    if queued > 0 {
        println!("[TrackCache] queued {queued} preloads");
    }
    Ok(())
}

#[tauri::command]
pub async fn track_cache_size(state: State<'_, TrackCacheState>) -> Result<u64, String> {
    let state = state.inner().clone();
    run_blocking(move || state.cache_size()).await
}

#[tauri::command]
pub async fn track_liked_cache_size(state: State<'_, TrackCacheState>) -> Result<u64, String> {
    let state = state.inner().clone();
    run_blocking(move || state.liked_cache_size()).await
}

#[tauri::command]
pub async fn track_clear_cache(state: State<'_, TrackCacheState>) -> Result<(), String> {
    let state = state.inner().clone();
    run_blocking(move || state.clear_cache()).await
}

#[tauri::command]
pub fn track_remove_cached(urn: String, state: State<'_, TrackCacheState>) -> bool {
    canonical_track_urn(&urn).is_some_and(|urn| state.remove_cached(&urn))
}

#[tauri::command]
pub async fn track_demote_liked(
    urn: String,
    state: State<'_, TrackCacheState>,
) -> Result<bool, String> {
    let Some(urn) = canonical_track_urn(&urn) else {
        return Ok(false);
    };
    let state = state.inner().clone();
    run_blocking(move || state.demote_from_liked(&urn)).await
}

#[tauri::command]
pub async fn track_clear_liked_cache(state: State<'_, TrackCacheState>) -> Result<(), String> {
    let state = state.inner().clone();
    run_blocking(move || state.clear_liked_cache()).await
}

#[tauri::command]
pub async fn track_list_cached(state: State<'_, TrackCacheState>) -> Result<Vec<String>, String> {
    let state = state.inner().clone();
    run_blocking(move || state.list_cached_urns()).await
}

#[tauri::command]
pub async fn track_cache_inventory(
    state: State<'_, TrackCacheState>,
) -> Result<Vec<CacheInventoryEntry>, String> {
    let state = state.inner().clone();
    run_blocking(move || state.cache_inventory()).await
}

#[tauri::command]
pub async fn track_enforce_cache_limit(
    limit_mb: u64,
    state: State<'_, TrackCacheState>,
) -> Result<(), String> {
    let state = state.inner().clone();
    run_blocking(move || state.enforce_limit(limit_mb)).await
}

#[tauri::command]
pub async fn track_purge_played(
    keep_urn: Option<String>,
    state: State<'_, TrackCacheState>,
) -> Result<u32, String> {
    let keep = keep_urn.as_deref().and_then(canonical_track_urn);
    let state = state.inner().clone();
    run_blocking(move || state.purge_played(keep.as_deref())).await
}

#[tauri::command]
pub async fn track_bulk_cache_start(
    scope: String,
    entries: Vec<BulkCacheEntry>,
    state: State<'_, TrackCacheState>,
) -> Result<(), String> {
    let entries: Vec<BulkCacheEntry> = entries
        .into_iter()
        .filter_map(|mut entry| {
            entry.urn = canonical_track_urn(&entry.urn)?;
            Some(entry)
        })
        .collect();
    state.begin_bulk_cache(scope, entries.len() as u32)?;
    let state = state.inner().clone();
    tokio::spawn(async move {
        state.run_bulk_cache(entries).await;
    });
    Ok(())
}

#[tauri::command]
pub fn track_bulk_cache_status(state: State<'_, TrackCacheState>) -> Option<BulkCacheStatus> {
    state.bulk_cache_status()
}

#[tauri::command]
pub fn track_bulk_cache_cancel(state: State<'_, TrackCacheState>) {
    state.cancel_bulk_cache();
}
