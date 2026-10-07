use std::sync::Arc;

use tauri::State;

use super::snapshot::NowPlaying;
use super::state::{ObsConfig, ObsState, ObsStatus};

type Obs<'a> = State<'a, Arc<ObsState>>;

#[tauri::command]
pub async fn obs_configure(config: ObsConfig, state: Obs<'_>) -> Result<ObsStatus, String> {
    Ok(state.configure(config).await)
}

#[tauri::command]
pub async fn obs_update(np: NowPlaying, state: Obs<'_>) -> Result<ObsStatus, String> {
    Ok(state.update(np).await)
}

#[tauri::command]
pub async fn obs_status(state: Obs<'_>) -> Result<ObsStatus, String> {
    Ok(state.status().await)
}
