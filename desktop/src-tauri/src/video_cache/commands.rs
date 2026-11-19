use std::sync::Arc;

use tauri::State;

use super::{VideoCache, lru};
use crate::shared::blocking::run_blocking;

#[tauri::command]
pub async fn video_fetch(url: String, state: State<'_, Arc<VideoCache>>) -> Result<String, String> {
    state.inner().clone().fetch(url).await
}

#[tauri::command]
pub async fn video_cache_size(state: State<'_, Arc<VideoCache>>) -> Result<u64, String> {
    let dir = state.dir().to_path_buf();
    run_blocking(move || lru::size(&dir)).await
}

#[tauri::command]
pub async fn video_cache_clear(state: State<'_, Arc<VideoCache>>) -> Result<u32, String> {
    let dir = state.dir().to_path_buf();
    run_blocking(move || lru::clear(&dir)).await
}

#[tauri::command]
pub async fn video_cache_enforce_limit(
    limit_mb: u64,
    state: State<'_, Arc<VideoCache>>,
) -> Result<u64, String> {
    let dir = state.dir().to_path_buf();
    run_blocking(move || lru::enforce_limit(&dir, limit_mb)).await
}
