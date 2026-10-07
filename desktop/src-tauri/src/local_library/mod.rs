mod scan;
mod tags;

use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{Emitter, Manager};

use crate::rt::AppHandle;
use crate::shared::blocking::run_blocking;

const COVERS_DIR: &str = "local-covers";
const PROGRESS_EVENT: &str = "local-library:scan-progress";
const PROGRESS_EVERY: usize = 20;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalTrackInfo {
    id: String,
    path: String,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    album_artist: Option<String>,
    genre: Option<String>,
    year: Option<u32>,
    track_number: Option<u32>,
    duration_ms: Option<u64>,
    cover: Option<String>,
    bytes: u64,
    modified_at: u64,
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    tracks: Vec<LocalTrackInfo>,
    folders: Vec<String>,
}

#[derive(Clone, Serialize)]
struct ScanProgress {
    done: usize,
    total: usize,
}

pub fn covers_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(COVERS_DIR)
}

fn track_id(path: &Path) -> String {
    let digest = Sha256::digest(path.to_string_lossy().as_bytes());
    hex::encode(&digest[..10])
}

fn remove_covers(dir: &Path, id: &str) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let prefix = format!("{id}.");
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(&prefix) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

fn store_cover(dir: &Path, id: &str, cover: &tags::Cover) -> Option<String> {
    let name = format!("{id}.{}", tags::cover_extension(&cover.media_type));
    remove_covers(dir, id);
    std::fs::write(dir.join(&name), &cover.data).ok()?;
    Some(name)
}

fn describe(path: &Path, covers: &Path) -> LocalTrackInfo {
    let id = track_id(path);
    let meta = std::fs::metadata(path).ok();
    let modified_at = meta
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_millis() as u64);
    let tags = tags::read(path);
    let cover = tags
        .cover
        .as_ref()
        .and_then(|c| store_cover(covers, &id, c));
    let title = tags.title.unwrap_or_else(|| {
        path.file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default()
    });

    LocalTrackInfo {
        id,
        path: path.to_string_lossy().into_owned(),
        title,
        artist: tags.artist,
        album: tags.album,
        album_artist: tags.album_artist,
        genre: tags.genre,
        year: tags.year,
        track_number: tags.track_number,
        duration_ms: tags.duration_ms,
        cover,
        bytes: meta.map_or(0, |m| m.len()),
        modified_at,
    }
}

fn app_covers_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = covers_dir(&app.path().app_data_dir().map_err(|e| e.to_string())?);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub async fn local_library_scan(paths: Vec<String>, app: AppHandle) -> Result<ScanResult, String> {
    let covers = app_covers_dir(&app)?;
    run_blocking(move || {
        let roots: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        let folders = roots
            .iter()
            .filter(|root| root.is_dir())
            .map(|root| root.to_string_lossy().into_owned())
            .collect();
        let files = scan::collect(&roots);
        let total = files.len();
        let mut tracks = Vec::with_capacity(total);
        for (index, file) in files.iter().enumerate() {
            tracks.push(describe(file, &covers));
            let done = index + 1;
            if done % PROGRESS_EVERY == 0 || done == total {
                app.emit(PROGRESS_EVENT, ScanProgress { done, total }).ok();
            }
        }
        ScanResult { tracks, folders }
    })
    .await
}

#[tauri::command]
pub async fn local_library_missing(paths: Vec<String>) -> Result<Vec<String>, String> {
    run_blocking(move || {
        paths
            .into_iter()
            .filter(|p| !Path::new(p).is_file())
            .collect()
    })
    .await
}

#[tauri::command]
pub async fn local_library_forget(ids: Vec<String>, app: AppHandle) -> Result<(), String> {
    let covers = app_covers_dir(&app)?;
    run_blocking(move || {
        for id in ids
            .iter()
            .filter(|id| id.chars().all(|c| c.is_ascii_hexdigit()))
        {
            remove_covers(&covers, id);
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_id_is_stable_hex() {
        let a = track_id(Path::new("/music/a.mp3"));
        assert_eq!(a, track_id(Path::new("/music/a.mp3")));
        assert_ne!(a, track_id(Path::new("/music/b.mp3")));
        assert_eq!(a.len(), 20);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn describe_falls_back_to_the_file_name() {
        let dir = std::env::temp_dir().join(format!("scd-local-describe-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("My Song.mp3");
        std::fs::write(&file, b"not audio").unwrap();

        let info = describe(&file, &dir);
        assert_eq!(info.title, "My Song");
        assert_eq!(info.bytes, 9);
        assert!(info.cover.is_none());
        assert!(info.artist.is_none());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
