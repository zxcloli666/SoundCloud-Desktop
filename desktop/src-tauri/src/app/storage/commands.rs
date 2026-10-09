use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

use super::StorageLocation;
use super::relocate::{self, Progress, RelocateError};
use crate::rt::AppHandle;
use crate::shared::blocking::run_blocking;

const PROGRESS_EVENT: &str = "storage:relocate-progress";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageLocationInfo {
    path: String,
    default_path: String,
    is_default: bool,
    unavailable_path: Option<String>,
}

#[tauri::command]
pub fn storage_location_info(state: State<'_, Arc<StorageLocation>>) -> StorageLocationInfo {
    StorageLocationInfo {
        path: state.active_root.display().to_string(),
        default_path: state.default_root.display().to_string(),
        is_default: state.active_root == state.default_root,
        unavailable_path: state
            .is_unavailable()
            .then(|| state.configured_root.as_ref())
            .flatten()
            .map(|root| root.display().to_string()),
    }
}

#[tauri::command]
pub async fn storage_relocate(
    app: AppHandle,
    state: State<'_, Arc<StorageLocation>>,
    target: Option<String>,
    move_files: bool,
) -> Result<String, String> {
    let state = state.inner().clone();
    if state.relocating.swap(true, Ordering::AcqRel) {
        return Err(RelocateError::Busy.code().into());
    }
    let worker = state.clone();
    let result = run_blocking(move || relocate_blocking(&app, &worker, target, move_files))
        .await
        .unwrap_or(Err(RelocateError::Failed));
    state.relocating.store(false, Ordering::Release);
    result
        .map(|root| root.display().to_string())
        .map_err(|err| err.code().into())
}

fn relocate_blocking(
    app: &AppHandle,
    state: &StorageLocation,
    target: Option<String>,
    move_files: bool,
) -> Result<PathBuf, RelocateError> {
    let target_root = match target {
        Some(picked) => relocate::root_for_pick(&PathBuf::from(picked)),
        None => state.default_root.clone(),
    };
    if state.is_unavailable() && target_root == state.active_root {
        state
            .commit(&target_root)
            .map_err(|_| RelocateError::Failed)?;
        return Ok(target_root);
    }
    relocate::validate_target(&state.active_root, &target_root)?;
    let target_dirs = relocate::prepare_target(&target_root)?;
    if move_files {
        relocate::copy_cache(&state.audio_dirs(), &target_dirs, |progress: Progress| {
            let _ = app.emit(PROGRESS_EVENT, progress);
        })?;
    }
    state
        .commit(&target_root)
        .map_err(|_| RelocateError::Failed)?;
    Ok(target_root)
}

#[tauri::command]
pub fn storage_open_folder(
    app: AppHandle,
    state: State<'_, Arc<StorageLocation>>,
) -> Result<(), String> {
    app.opener()
        .open_path(state.active_root.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_restart(app: AppHandle) -> Result<(), String> {
    let handle = app.clone();
    app.run_on_main_thread(move || {
        tauri_plugin_single_instance::destroy(&handle);
        handle.cleanup_before_exit();
        tauri::process::restart(&handle.env());
    })
    .map_err(|e| e.to_string())
}
