use tauri::State;

use crate::shared::blocking::run_blocking;
use crate::shared::urn::canonical_track_urn;
use crate::track_cache::state::{
    CacheInventoryEntry, CacheRequest, LikeCacheEntry, TrackCacheEntry, TrackCacheState,
    TranscodeStatus,
};

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

/// Download-to-file. Pulls from the clean m4a cache, transcoding raw bytes or
/// fetching from streaming as needed, and embeds `cover_url` when possible.
#[tauri::command]
pub async fn track_export(
    request: EnsureCachedRequest,
    dest_path: String,
    cover_url: Option<String>,
    state: State<'_, TrackCacheState>,
) -> Result<String, String> {
    let urn = require_track_urn(&request.urn)?;
    let fallback_urls = request
        .fallback_urls()
        .ok_or_else(|| "no stream URL provided".to_string())?;
    let storage_urls = request.storage_urls.unwrap_or_default();
    let download_urls = request.download_urls.unwrap_or_default();
    state
        .export_track(
            CacheRequest {
                urn: &urn,
                urls: &fallback_urls,
                download_urls: &download_urls,
                storage_urls: &storage_urls,
                session_id: request.session_id.as_deref(),
                hq: request.hq,
                storage_quality: request.storage_quality.as_deref(),
                liked: false,
                expected_duration_ms: request.duration_ms,
            },
            dest_path,
            cover_url,
        )
        .await
}

#[tauri::command]
pub async fn track_save_offline(
    request: EnsureCachedRequest,
    refetch: bool,
    state: State<'_, TrackCacheState>,
) -> Result<TrackCacheEntry, String> {
    let urn = require_track_urn(&request.urn)?;
    let fallback_urls = request
        .fallback_urls()
        .ok_or_else(|| "no stream URL provided".to_string())?;
    let storage_urls = request.storage_urls.unwrap_or_default();
    let download_urls = request.download_urls.unwrap_or_default();
    state
        .save_offline(
            CacheRequest {
                urn: &urn,
                urls: &fallback_urls,
                download_urls: &download_urls,
                storage_urls: &storage_urls,
                session_id: request.session_id.as_deref(),
                hq: request.hq,
                storage_quality: request.storage_quality.as_deref(),
                liked: true,
                expected_duration_ms: request.duration_ms,
            },
            refetch,
        )
        .await
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
pub async fn track_cache_likes(
    entries: Vec<LikeCacheEntry>,
    state: State<'_, TrackCacheState>,
) -> Result<(), String> {
    let entries: Vec<LikeCacheEntry> = entries
        .into_iter()
        .filter_map(|mut entry| {
            entry.urn = canonical_track_urn(&entry.urn)?;
            Some(entry)
        })
        .collect();
    let state = state.inner().clone();
    tokio::spawn(async move {
        if let Err(err) = state.cache_likes(entries).await {
            eprintln!("[TrackCache] cache_likes error: {err}");
        }
    });
    Ok(())
}

#[tauri::command]
pub fn track_cache_likes_running(state: State<'_, TrackCacheState>) -> bool {
    state.cache_likes_running()
}

#[tauri::command]
pub fn track_cancel_cache_likes(state: State<'_, TrackCacheState>) {
    state.cancel_cache_likes();
}
