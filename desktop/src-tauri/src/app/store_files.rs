use std::fs::OpenOptions;
use std::io;
use std::path::Path;

use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn store_flush(app: AppHandle, name: String) -> Result<(), String> {
    if !is_temp_file(&name) {
        return Err(format!("not a store temp file: {name}"));
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(name);
    tauri::async_runtime::spawn_blocking(move || flush(&path))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

fn is_temp_file(name: &str) -> bool {
    name.ends_with(".tmp") && !name.starts_with('.') && !name.contains(['/', '\\', ':'])
}

fn flush(path: &Path) -> io::Result<()> {
    OpenOptions::new().write(true).open(path)?.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_bare_temp_file_name_is_taken() {
        assert!(is_temp_file("sc-voice.json.main.tmp"));
        assert!(is_temp_file("sc-settings.json.tray-popover.tmp"));
        for name in [
            "sc-voice.json",
            "../sc-voice.json.main.tmp",
            "chat/x.tmp",
            "chat\\x.tmp",
            "C:x.tmp",
            ".tmp",
            "..",
            "",
        ] {
            assert!(!is_temp_file(name), "{name}");
        }
    }

    #[test]
    fn flush_keeps_the_bytes_and_never_creates_a_file() {
        let dir = std::env::temp_dir().join(format!("store-flush-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("sc-voice.json.main.tmp");
        std::fs::write(&file, b"{\"state\":1}").unwrap();
        flush(&file).unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), b"{\"state\":1}");
        let missing = dir.join("missing.json.main.tmp");
        assert!(flush(&missing).is_err());
        assert!(!missing.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
