use std::path::{Path, PathBuf};

use sc_chat::NotifyPrefs;

use crate::app::APP_IDENTIFIER;
use crate::chat::DIR;

const FILE: &str = "notify.json";

pub fn path() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(APP_IDENTIFIER).join(DIR).join(FILE))
}

pub fn read(path: &Path) -> Option<NotifyPrefs> {
    let raw = std::fs::read(path).ok()?;
    serde_json::from_slice(&raw).ok()
}

pub fn write(path: &Path, prefs: &NotifyPrefs) {
    let Ok(raw) = serde_json::to_vec(prefs) else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(path, raw);
}
