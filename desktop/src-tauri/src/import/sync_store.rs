use std::io::Write;
use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::rt::AppHandle;

const FILE: &str = "import_sync.json";

fn file_of(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(FILE))
}

fn open_private(path: &Path) -> std::io::Result<std::fs::File> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

pub fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension(format!("tmp-{}", std::process::id()));
    let _ = std::fs::remove_file(&tmp);
    {
        let mut file = open_private(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    if let Err(e) = std::fs::rename(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(())
}

#[tauri::command]
pub async fn import_sync_load(app: AppHandle) -> Result<Option<String>, String> {
    let path = file_of(&app)?;
    match tokio::fs::read_to_string(&path).await {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn import_sync_store(json: String, app: AppHandle) -> Result<(), String> {
    let path = file_of(&app)?;
    tokio::task::spawn_blocking(move || write_private(&path, json.as_bytes()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::write_private;

    #[test]
    fn file_is_private_and_rewrites_cleanly() {
        let dir = std::env::temp_dir().join(format!("sc-sync-test-{}", std::process::id()));
        let path = dir.join("import_sync.json");
        write_private(&path, b"{\"ymToken\":\"a\"}").unwrap();
        write_private(&path, b"{\"ymToken\":null}").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"{\"ymToken\":null}");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        let leftovers = std::fs::read_dir(&dir).unwrap().count();
        assert_eq!(leftovers, 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
