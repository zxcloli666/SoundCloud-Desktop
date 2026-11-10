use std::path::{Path, PathBuf};

use sc_chat::NotifyPrefs;

const FILE: &str = "notify.json";

pub fn path(chat_dir: &Path) -> PathBuf {
    chat_dir.join(FILE)
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
