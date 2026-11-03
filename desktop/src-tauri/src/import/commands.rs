use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;

use super::failure::Failure;
use super::request::Request;
use super::run::{build_client, run};
use super::source::detect;
use super::ym::{Ym, YmLibrary, clean_token};

static CANCEL_FLAG: std::sync::LazyLock<Arc<AtomicBool>> =
    std::sync::LazyLock::new(|| Arc::new(AtomicBool::new(false)));

fn give_up(app: &AppHandle, step: &str, failure: Failure) -> String {
    log_native(
        app,
        "WARN",
        format!("[Import] {step} failed: {}", failure.detail),
    );
    failure.code.to_string()
}

#[tauri::command]
pub async fn import_start(
    request: Request,
    backend_url: String,
    session_id: String,
    app: AppHandle,
) -> Result<(), String> {
    CANCEL_FLAG.store(false, Ordering::Relaxed);
    run(&app, request, &backend_url, &session_id, &CANCEL_FLAG)
        .await
        .map_err(|failure| give_up(&app, "run", failure))
}

#[tauri::command]
pub fn import_stop() {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn import_detect(input: String) -> Option<&'static str> {
    detect(&input).map(|source| source.label())
}

#[tauri::command]
pub async fn import_ym_library(token: String, app: AppHandle) -> Result<YmLibrary, String> {
    let client = build_client().map_err(|failure| give_up(&app, "client", failure))?;
    let token = clean_token(&token);
    Ym {
        client: &client,
        token: Some(&token),
        cancel: &CANCEL_FLAG,
    }
    .library()
    .await
    .map_err(|failure| give_up(&app, "library", failure))
}

const MAX_LIST_FILE_BYTES: u64 = 2 * 1024 * 1024;

#[tauri::command]
pub async fn import_read_list_file(path: String) -> Result<String, String> {
    let extension = std::path::Path::new(&path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase);
    if !matches!(extension.as_deref(), Some("txt" | "csv" | "tsv")) {
        return Err("bad_file".to_string());
    }
    let size = tokio::fs::metadata(&path)
        .await
        .map_err(|e| e.to_string())?
        .len();
    if size > MAX_LIST_FILE_BYTES {
        return Err("bad_file".to_string());
    }
    let bytes = tokio::fs::read(&path).await.map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub fn import_notify(title: String, body: String, app: AppHandle) {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .ok();
}
