mod install_kind;

use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::Manager;
use tauri::ipc::Channel;
use tauri_plugin_updater::UpdaterExt;

use crate::app::diagnostics::log_native;
use crate::app::popover::TrayState;
use crate::rt::{App, AppHandle};
use install_kind::InstallKind;

const PROGRESS_STEP_BYTES: u64 = 512 * 1024;

static SIGNED_UPDATES: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterInfo {
    os: &'static str,
    arch: &'static str,
    kind: InstallKind,
    self_update: bool,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum InstallProgress {
    #[serde(rename_all = "camelCase")]
    Started {
        total: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        downloaded: u64,
        total: Option<u64>,
    },
    Installing,
}

pub fn register(app: &App) {
    if !app.config().plugins.0.contains_key("updater") {
        return;
    }
    match app
        .handle()
        .plugin(tauri_plugin_updater::Builder::new().build())
    {
        Ok(()) => SIGNED_UPDATES.store(true, Ordering::Relaxed),
        Err(error) => log_native(app.handle(), "WARN", format!("[updater] disabled: {error}")),
    }
}

fn self_update(kind: InstallKind) -> bool {
    SIGNED_UPDATES.load(Ordering::Relaxed) && kind.self_updatable()
}

#[tauri::command]
pub fn updater_info() -> UpdaterInfo {
    let kind = install_kind::detect();
    UpdaterInfo {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        kind,
        self_update: self_update(kind),
    }
}

#[tauri::command]
pub async fn updater_install(
    app: AppHandle,
    on_progress: Channel<InstallProgress>,
) -> Result<(), String> {
    if !self_update(install_kind::detect()) {
        return Err("self update is not available for this install".into());
    }
    let result = download_and_install(&app, &on_progress).await;
    if let Err(error) = &result {
        log_native(&app, "ERROR", format!("[updater] install failed: {error}"));
    }
    result
}

async fn download_and_install(
    app: &AppHandle,
    on_progress: &Channel<InstallProgress>,
) -> Result<(), String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no update available".to_string())?;
    log_native(
        app,
        "INFO",
        format!(
            "[updater] installing {} -> {}",
            update.current_version, update.version
        ),
    );

    let mut downloaded = 0u64;
    let mut reported = 0u64;
    let mut started = false;
    let bytes = update
        .download(
            |chunk, total| {
                if !started {
                    started = true;
                    let _ = on_progress.send(InstallProgress::Started { total });
                }
                downloaded += chunk as u64;
                let finished = total.is_some_and(|t| downloaded >= t);
                if finished || downloaded - reported >= PROGRESS_STEP_BYTES {
                    reported = downloaded;
                    let _ = on_progress.send(InstallProgress::Progress { downloaded, total });
                }
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;

    let _ = on_progress.send(InstallProgress::Installing);
    app.state::<TrayState>().persist_position();
    tauri::async_runtime::spawn_blocking(move || update.install(bytes))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    app.request_restart();
    Ok(())
}
