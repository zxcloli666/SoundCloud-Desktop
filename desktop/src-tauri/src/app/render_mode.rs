use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::rt::AppHandle;

const FLAG_FILE: &str = "render_mode.json";
const APP_IDENTIFIER: &str = "com.soundcloud.desktop";
const SUPPORTED: bool = cfg!(all(not(feature = "cef"), any(windows, target_os = "linux")));

#[cfg(all(windows, not(feature = "cef")))]
const WEBVIEW2_ARGS_ENV: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";
#[cfg(all(windows, not(feature = "cef")))]
const WEBVIEW2_DEFAULT_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection";
#[cfg(all(windows, not(feature = "cef")))]
const DISABLE_GPU_ARG: &str = "--disable-gpu";

static LAUNCHED_SOFTWARE: OnceLock<bool> = OnceLock::new();

#[derive(Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct Flag {
    software_rendering: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderMode {
    supported: bool,
    software_rendering: bool,
    restart_required: bool,
}

fn flag_path() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(APP_IDENTIFIER).join(FLAG_FILE))
}

fn load_flag() -> Flag {
    flag_path()
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save_flag(flag: &Flag) -> Result<(), String> {
    let path = flag_path().ok_or("app data dir is unavailable")?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = serde_json::to_vec(flag).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

fn launched_software() -> bool {
    LAUNCHED_SOFTWARE.get().copied().unwrap_or(false)
}

pub fn apply_before_launch() {
    let software = SUPPORTED && load_flag().software_rendering;
    LAUNCHED_SOFTWARE.get_or_init(|| software);
    if software {
        disable_gpu();
    }
}

#[cfg(all(windows, not(feature = "cef")))]
fn disable_gpu() {
    let current = std::env::var(WEBVIEW2_ARGS_ENV).unwrap_or_default();
    if current.split_whitespace().any(|arg| arg == DISABLE_GPU_ARG) {
        return;
    }
    let base = if current.trim().is_empty() {
        WEBVIEW2_DEFAULT_ARGS
    } else {
        current.trim()
    };
    unsafe { std::env::set_var(WEBVIEW2_ARGS_ENV, format!("{base} {DISABLE_GPU_ARG}")) };
}

#[cfg(all(target_os = "linux", not(feature = "cef")))]
fn disable_gpu() {
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

#[cfg(not(all(any(windows, target_os = "linux"), not(feature = "cef"))))]
fn disable_gpu() {}

fn current_mode() -> RenderMode {
    let software_rendering = SUPPORTED && load_flag().software_rendering;
    RenderMode {
        supported: SUPPORTED,
        software_rendering,
        restart_required: software_rendering != launched_software(),
    }
}

#[tauri::command]
pub fn render_mode_get() -> RenderMode {
    current_mode()
}

#[tauri::command]
pub fn render_mode_set(software_rendering: bool) -> Result<RenderMode, String> {
    if !SUPPORTED {
        return Err("software rendering is not supported on this platform".into());
    }
    save_flag(&Flag { software_rendering })?;
    Ok(current_mode())
}

#[tauri::command]
pub fn render_mode_restart(app: AppHandle) {
    app.request_restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flag_round_trips_in_camel_case() {
        let bytes = serde_json::to_vec(&Flag {
            software_rendering: true,
        })
        .unwrap();
        assert_eq!(bytes, br#"{"softwareRendering":true}"#);
        let parsed: Flag = serde_json::from_slice(&bytes).unwrap();
        assert!(parsed.software_rendering);
    }

    #[test]
    fn broken_flag_falls_back_to_hardware() {
        let parsed: Flag = serde_json::from_slice(b"{}").unwrap();
        assert!(!parsed.software_rendering);
    }
}
