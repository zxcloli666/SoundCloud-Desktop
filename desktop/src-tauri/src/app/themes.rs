pub mod sentinel;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};
use tauri::Manager;
use tauri::ipc::{InvokeBody, Request};

use crate::rt::AppHandle;
use crate::shared::blocking::run_blocking;

const EXTENSIONS: [&str; 9] = [
    "css", "webp", "png", "jpg", "jpeg", "avif", "gif", "svg", "woff2",
];
const CSS_MAX_BYTES: usize = 256 * 1024;
const ASSET_MAX_BYTES: usize = 1024 * 1024;
const TMP_MAX_AGE: Duration = Duration::from_secs(60 * 60);

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

pub fn files_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("themes").join("files")
}

fn is_sha(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

fn is_file_name(name: &str) -> bool {
    name.split_once('.')
        .is_some_and(|(sha, ext)| is_sha(sha) && EXTENSIONS.contains(&ext))
}

fn is_tmp_name(name: &str) -> bool {
    name.strip_suffix(".tmp")
        .and_then(|rest| rest.rsplit_once('.'))
        .is_some_and(|(file, _)| is_file_name(file))
}

pub fn is_served_name(name: &str) -> bool {
    is_file_name(name) && !name.ends_with(".css")
}

fn app_files_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(files_dir(
        &app.path().app_data_dir().map_err(|e| e.to_string())?,
    ))
}

fn header(request: &Request<'_>, name: &str) -> Result<String, String> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .ok_or_else(|| format!("missing {name}"))
}

fn has_len(path: &Path, len: usize) -> bool {
    std::fs::metadata(path).is_ok_and(|meta| meta.len() == len as u64)
}

fn store(dir: &Path, sha: &str, ext: &str, body: &[u8]) -> Result<String, String> {
    if !is_sha(sha) || !EXTENSIONS.contains(&ext) {
        return Err("bad theme file name".into());
    }
    let cap = if ext == "css" {
        CSS_MAX_BYTES
    } else {
        ASSET_MAX_BYTES
    };
    if body.len() > cap {
        return Err("theme file too large".into());
    }
    let name = format!("{sha}.{ext}");
    let target = dir.join(&name);
    if has_len(&target, body.len()) {
        return Ok(name);
    }
    if hex::encode(Sha256::digest(body)) != sha {
        return Err("theme file hash mismatch".into());
    }
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos());
    let counter = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let tmp = dir.join(format!("{name}.{nanos}-{counter}.tmp"));
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    if let Err(error) = std::fs::rename(&tmp, &target) {
        let _ = std::fs::remove_file(&tmp);
        if !has_len(&target, body.len()) {
            return Err(error.to_string());
        }
    }
    Ok(name)
}

fn collect(dir: &Path, keep: &[String], now: SystemTime) -> u32 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    let mut removed = 0;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        let stale = if is_file_name(&name) {
            !keep.contains(&name)
        } else {
            is_tmp_name(&name)
                && std::fs::metadata(&path)
                    .and_then(|meta| meta.modified())
                    .is_ok_and(|modified| {
                        now.duration_since(modified).unwrap_or_default() > TMP_MAX_AGE
                    })
        };
        if stale && std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    removed
}

#[tauri::command]
pub async fn theme_file_store(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let body = match request.body() {
        InvokeBody::Raw(body) => body.clone(),
        InvokeBody::Json(value) => {
            serde_json::from_value::<Vec<u8>>(value.clone()).map_err(|e| e.to_string())?
        }
    };
    let sha = header(&request, "x-theme-sha256")?;
    let ext = header(&request, "x-theme-ext")?;
    let dir = app_files_dir(&app)?;
    run_blocking(move || store(&dir, &sha, &ext, &body)).await?
}

#[tauri::command]
pub async fn theme_files_gc(app: AppHandle, keep: Vec<String>) -> Result<u32, String> {
    if let Some(bad) = keep.iter().find(|name| !is_file_name(name)) {
        return Err(format!("bad theme file name: {bad}"));
    }
    let dir = app_files_dir(&app)?;
    run_blocking(move || collect(&dir, &keep, SystemTime::now())).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scd-themes-{name}-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sha(body: &[u8]) -> String {
        hex::encode(Sha256::digest(body))
    }

    fn age(path: &Path, by: Duration) {
        let file = std::fs::File::options().write(true).open(path).unwrap();
        file.set_modified(SystemTime::now() - by).unwrap();
    }

    #[test]
    fn stores_by_hash() {
        let dir = temp_dir("store");
        let body = b"a{color:red}";
        let name = store(&dir, &sha(body), "css", body).unwrap();
        assert_eq!(name, format!("{}.css", sha(body)));
        assert_eq!(std::fs::read(dir.join(&name)).unwrap(), body);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_wrong_hash() {
        let dir = temp_dir("hash");
        let error = store(&dir, &sha(b"other"), "css", b"a{}").unwrap_err();
        assert!(error.contains("mismatch"));
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_bad_ext_and_traversal() {
        let dir = temp_dir("names");
        let body = b"a{}";
        assert!(store(&dir, &sha(body), "js", body).is_err());
        assert!(store(&dir, &sha(body), "css/../x", body).is_err());
        assert!(store(&dir, "../../escape", "css", body).is_err());
        assert!(store(&dir, &sha(body).to_uppercase(), "css", body).is_err());
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_oversize() {
        let dir = temp_dir("size");
        let css = vec![b' '; CSS_MAX_BYTES + 1];
        assert!(store(&dir, &sha(&css), "css", &css).is_err());
        let image = vec![0u8; ASSET_MAX_BYTES + 1];
        assert!(store(&dir, &sha(&image), "png", &image).is_err());
        let fits = vec![0u8; CSS_MAX_BYTES + 1];
        assert!(store(&dir, &sha(&fits), "png", &fits).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn same_content_twice_and_concurrently() {
        let dir = temp_dir("twice");
        let body = vec![7u8; 64 * 1024];
        let hash = sha(&body);
        let first = store(&dir, &hash, "webp", &body).unwrap();
        assert_eq!(store(&dir, &hash, "webp", &body).unwrap(), first);
        std::fs::remove_file(dir.join(&first)).unwrap();

        let tasks: Vec<_> = (0..2)
            .map(|_| {
                let (dir, hash, body) = (dir.clone(), hash.clone(), body.clone());
                tokio::task::spawn_blocking(move || store(&dir, &hash, "webp", &body))
            })
            .collect();
        for task in tasks {
            assert_eq!(task.await.unwrap().unwrap(), first);
        }
        let names: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec![first]);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn gc_keeps_listed_and_skips_fresh_tmp() {
        let dir = temp_dir("gc");
        let kept = store(&dir, &sha(b"kept"), "css", b"kept").unwrap();
        let dropped = store(&dir, &sha(b"dropped"), "svg", b"dropped").unwrap();
        let fresh = dir.join(format!("{dropped}.1-1.tmp"));
        let old = dir.join(format!("{dropped}.2-2.tmp"));
        let foreign = dir.join("notes.txt");
        for path in [&fresh, &old, &foreign] {
            std::fs::write(path, b"x").unwrap();
        }
        age(&old, Duration::from_secs(2 * 60 * 60));
        age(&foreign, Duration::from_secs(2 * 60 * 60));

        assert_eq!(
            collect(&dir, std::slice::from_ref(&kept), SystemTime::now()),
            2
        );
        assert!(dir.join(&kept).exists());
        assert!(!dir.join(&dropped).exists());
        assert!(fresh.exists());
        assert!(!old.exists());
        assert!(foreign.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn served_names_exclude_css() {
        let hash = sha(b"x");
        assert!(is_served_name(&format!("{hash}.svg")));
        assert!(is_served_name(&format!("{hash}.woff2")));
        assert!(!is_served_name(&format!("{hash}.css")));
        assert!(!is_served_name(&format!("{hash}.svg.1-1.tmp")));
        assert!(!is_served_name("x.svg"));
    }
}
