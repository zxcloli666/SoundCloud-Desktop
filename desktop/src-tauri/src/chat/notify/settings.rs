use serde::Deserialize;
use tauri::Manager;

use crate::rt::AppHandle;

const SETTINGS_FILE: &str = "sc-settings.json";

#[derive(Default, Deserialize)]
#[serde(default)]
struct Persisted {
    state: AppSettings,
}

#[derive(Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub language: String,
    pub obs_enabled: bool,
}

pub fn read(app: &AppHandle) -> AppSettings {
    app.path()
        .app_data_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join(SETTINGS_FILE)).ok())
        .map(|raw| parse(&raw))
        .unwrap_or_default()
}

pub fn parse(raw: &[u8]) -> AppSettings {
    serde_json::from_slice::<Persisted>(raw)
        .map(|persisted| persisted.state)
        .unwrap_or_default()
}
