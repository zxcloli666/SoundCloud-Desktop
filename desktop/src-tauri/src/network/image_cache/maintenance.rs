use std::path::{Path, PathBuf};

use tokio::fs;

use crate::shared::blocking::run_blocking;
use crate::shared::file_lru::{collect_files, trim_to_limit};

fn cache_dirs() -> Vec<PathBuf> {
    let images = super::STATE.get().map(|s| s.dir.clone());
    let assets = crate::network::proxy::STATE
        .get()
        .map(|s| s.assets_dir.clone());
    images.into_iter().chain(assets).collect()
}

async fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(p) = stack.pop() {
        let mut entries = match fs::read_dir(&p).await {
            Ok(e) => e,
            Err(_) => continue,
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let Ok(ft) = entry.file_type().await else {
                continue;
            };
            if ft.is_dir() {
                stack.push(entry.path());
            } else if ft.is_file()
                && let Ok(meta) = entry.metadata().await {
                    total = total.saturating_add(meta.len());
                }
        }
    }
    total
}

async fn reset_dir(dir: &Path) -> Result<(), String> {
    if let Err(e) = fs::remove_dir_all(dir).await
        && e.kind() != std::io::ErrorKind::NotFound {
            return Err(e.to_string());
        }
    fs::create_dir_all(dir).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn image_cache_size() -> u64 {
    let mut total = 0u64;
    for dir in cache_dirs() {
        total = total.saturating_add(dir_size(&dir).await);
    }
    total
}

#[tauri::command]
pub async fn image_cache_clear() -> Result<(), String> {
    let dirs = cache_dirs();
    if dirs.is_empty() {
        return Err("image cache not ready".into());
    }
    for dir in dirs {
        reset_dir(&dir).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn image_cache_enforce_limit(limit_mb: u64) -> Result<u64, String> {
    if limit_mb == 0 {
        return Ok(0);
    }
    let dirs = cache_dirs();
    run_blocking(move || {
        let roots: Vec<&Path> = dirs.iter().map(PathBuf::as_path).collect();
        let freed = trim_to_limit(collect_files(&roots), limit_mb * 1024 * 1024);
        if freed > 0 {
            println!("[ImageCache] trimmed {} MB", freed / (1024 * 1024));
        }
        freed
    })
    .await
}
