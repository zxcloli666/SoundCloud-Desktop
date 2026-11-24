use std::path::Path;

use image::RgbaImage;
use tauri::Manager;

use super::{hicolor, shown};
use crate::rt::AppHandle;

const WINDOW: u32 = 256;

pub fn show(app: &AppHandle, _chosen: Option<&RgbaImage>) {
    let Some(icon) = shown(app, WINDOW) else {
        return;
    };
    for window in app.webview_windows().into_values() {
        let _ = window.set_icon(icon.clone());
    }
}

pub fn install(
    app: &AppHandle,
    _data_dir: &Path,
    chosen: Option<&RgbaImage>,
) -> Result<(), String> {
    if Path::new("/.flatpak-info").exists() {
        return Ok(());
    }
    let data = app.path().data_dir().map_err(|e| e.to_string())?;
    hicolor::write(&data.join("icons"), chosen)
}
