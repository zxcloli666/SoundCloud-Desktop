use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use sha2::{Digest, Sha256};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

use crate::network::edge::{self, Hop};
use crate::shared::constants::is_domain_whitelisted;

const MAX_IMAGE_CACHE_HOPS: usize = 3;
const IMAGE_CACHE_TOTAL_TIMEOUT: Duration = Duration::from_secs(18);
const IMAGE_CACHE_HOP_TIMEOUT: Duration = Duration::from_secs(6);
const IMAGE_CACHE_BODY_TIMEOUT: Duration = Duration::from_secs(12);
const NEGATIVE_CACHE_TTL: Duration = Duration::from_secs(12);
const NEGATIVE_CACHE_MAX_ENTRIES: usize = 512;

/// Permanent on-disk image cache.
///
/// Lives in `app_data_dir/images/` (NOT cache_dir) so the OS never reclaims
/// the files. The directory is sharded by the first two hex chars of the
/// SHA256 key so we never end up with hundreds of thousands of entries in
/// a single directory.
pub struct ImageCache {
    pub dir: PathBuf,
    pub http_client: reqwest::Client,
}

pub static STATE: OnceLock<ImageCache> = OnceLock::new();
static NEGATIVE_CACHE: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
static CACHE_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub struct ImageResult {
    pub status: u16,
    pub content_type: String,
    pub data: Vec<u8>,
}

fn cache_key(url: &str) -> String {
    hex::encode(Sha256::digest(url.as_bytes()))
}

fn cache_path(dir: &Path, key: &str) -> PathBuf {
    dir.join(&key[..2]).join(key)
}

fn bounded_image_hops(hops: Vec<Hop>) -> Vec<Hop> {
    let Some(first) = hops.first() else {
        return Vec::new();
    };
    if hops.len() <= MAX_IMAGE_CACHE_HOPS {
        return hops;
    }

    let mut selected = Vec::with_capacity(MAX_IMAGE_CACHE_HOPS);
    selected.push(first.clone());
    if let Some(alternate) = hops.iter().skip(1).find(|hop| hop.tier != first.tier) {
        selected.push(alternate.clone());
    }
    for hop in hops.iter().skip(1) {
        if selected.len() >= MAX_IMAGE_CACHE_HOPS {
            break;
        }
        if selected.iter().all(|selected_hop| selected_hop.url != hop.url) {
            selected.push(hop.clone());
        }
    }
    selected
}

fn deadline_budget(deadline: Instant, per_operation: Duration) -> Option<Duration> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        None
    } else {
        Some(remaining.min(per_operation))
    }
}

fn negative_cache() -> &'static Mutex<HashMap<String, Instant>> {
    NEGATIVE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_negative_cached(key: &str) -> bool {
    let now = Instant::now();
    let mut entries = match negative_cache().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    entries.retain(|_, expires_at| *expires_at > now);
    entries.contains_key(key)
}

fn note_negative_cache(key: &str) {
    let mut entries = match negative_cache().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    if entries.len() >= NEGATIVE_CACHE_MAX_ENTRIES {
        entries.clear();
    }
    entries.insert(key.to_string(), Instant::now() + NEGATIVE_CACHE_TTL);
}

fn clear_negative_cache(key: &str) {
    let mut entries = match negative_cache().lock() {
        Ok(guard) => guard,
        Err(poison) => poison.into_inner(),
    };
    entries.remove(key);
}

fn sniff_content_type(data: &[u8]) -> &'static str {
    if data.len() >= 3 && data[..3] == [0xFF, 0xD8, 0xFF] {
        "image/jpeg"
    } else if data.len() >= 8 && data[..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        "image/png"
    } else if data.len() >= 12 && &data[..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        "image/webp"
    } else if data.len() >= 6 && (&data[..6] == b"GIF87a" || &data[..6] == b"GIF89a") {
        "image/gif"
    } else if data.len() >= 12
        && &data[4..8] == b"ftyp"
        && (&data[8..12] == b"avif" || &data[8..12] == b"avis")
    {
        "image/avif"
    } else if data.len() >= 5 && (&data[..5] == b"<?xml" || &data[..4] == b"<svg") {
        "image/svg+xml"
    } else if data.len() >= 4 && data[..4] == [0x00, 0x00, 0x01, 0x00] {
        "image/x-icon"
    } else {
        "application/octet-stream"
    }
}

/// Publish a disposable cache entry atomically so readers never observe a
/// partial image. Durability across power loss is unnecessary for this cache.
async fn write_atomic(path: &Path, data: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = CACHE_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let tmp = path.with_extension(format!(
        "tmp-{}-{nonce}-{sequence}",
        std::process::id()
    ));
    {
        let mut f = File::create(&tmp).await?;
        f.write_all(data).await?;
    }
    if let Err(e) = fs::rename(&tmp, path).await {
        let _ = fs::remove_file(&tmp).await;
        return Err(e);
    }
    Ok(())
}

fn decode_payload(encoded: &str) -> Result<Vec<String>, ImageResult> {
    let decoded = urlencoding::decode(encoded).unwrap_or_default();
    let bytes = BASE64.decode(decoded.as_bytes()).map_err(|_| ImageResult {
        status: 400,
        content_type: "text/plain".into(),
        data: b"invalid base64".to_vec(),
    })?;
    serde_json::from_slice(&bytes).map_err(|_| ImageResult {
        status: 400,
        content_type: "text/plain".into(),
        data: b"invalid payload".to_vec(),
    })
}

pub async fn handle(encoded: &str) -> ImageResult {
    let state = match STATE.get() {
        Some(s) => s,
        None => {
            return ImageResult {
                status: 503,
                content_type: "text/plain".into(),
                data: b"not ready".to_vec(),
            }
        }
    };

    let payload = match decode_payload(encoded) {
        Ok(p) => p,
        Err(r) => return r,
    };

    let target_url = match payload.first() {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return ImageResult {
                status: 400,
                content_type: "text/plain".into(),
                data: b"missing target".to_vec(),
            }
        }
    };
    let upstreams = &payload[1..];
    if upstreams.is_empty() {
        return ImageResult {
            status: 400,
            content_type: "text/plain".into(),
            data: b"missing upstream".to_vec(),
        };
    }

    let host = target_url
        .split("://")
        .nth(1)
        .and_then(|rest| rest.split('/').next())
        .and_then(|authority| authority.split(':').next())
        .unwrap_or("");
    if is_domain_whitelisted(host) {
        return ImageResult {
            status: 403,
            content_type: "text/plain".into(),
            data: b"whitelisted domain".to_vec(),
        };
    }

    let key = cache_key(&target_url);
    let path = cache_path(&state.dir, &key);

    if let Ok(data) = fs::read(&path).await {
        if !data.is_empty() {
            #[cfg(debug_assertions)]
            println!("[ImageCache] HIT  {}", target_url);
            let ct = sniff_content_type(&data).to_string();
            return ImageResult {
                status: 200,
                content_type: ct,
                data,
            };
        }
        let _ = fs::remove_file(&path).await;
    }

    #[cfg(debug_assertions)]
    println!("[ImageCache] MISS {}", target_url);

    if is_negative_cached(&key) {
        return ImageResult {
            status: 502,
            content_type: "text/plain".into(),
            data: b"image temporarily unavailable".to_vec(),
        };
    }

    let encoded_for_header = BASE64.encode(target_url.as_bytes());
    let mut status = 502u16;
    let mut data: Vec<u8> = Vec::new();
    let deadline = Instant::now() + IMAGE_CACHE_TOTAL_TIMEOUT;

    for hop in bounded_image_hops(edge::expand_upstreams(upstreams)) {
        let Some(header_budget) = deadline_budget(deadline, IMAGE_CACHE_HOP_TIMEOUT) else {
            status = 504;
            break;
        };

        let resp = match tokio::time::timeout(
            header_budget,
            state
                .http_client
                .get(&hop.url)
                .header("X-Target", &encoded_for_header)
                .send(),
        )
        .await
        {
            Ok(Ok(r)) => r,
            Ok(Err(_)) | Err(_) => {
                hop.note(false);
                if Instant::now() >= deadline {
                    status = 504;
                    break;
                }
                continue;
            }
        };

        status = resp.status().as_u16();
        if !edge::hop_ok(&hop, &resp) {
            continue;
        }
        let Some(body_budget) = deadline_budget(deadline, IMAGE_CACHE_BODY_TIMEOUT) else {
            hop.note(false);
            status = 504;
            break;
        };
        let bytes = match tokio::time::timeout(body_budget, resp.bytes()).await {
            Ok(Ok(b)) => b,
            Ok(Err(_)) | Err(_) => {
                hop.note(false);
                if Instant::now() >= deadline {
                    status = 504;
                    break;
                }
                continue;
            }
        };
        data = bytes.to_vec();

        hop.note(status < 500);
        if status < 500 {
            break;
        }
    }

    let content_type = if status == 200 && !data.is_empty() {
        sniff_content_type(&data).to_string()
    } else {
        String::new()
    };

    let is_image = status == 200 && !data.is_empty() && content_type.starts_with("image/");
    if is_image {
        clear_negative_cache(&key);
        let path_clone = path.clone();
        let data_clone = data.clone();
        tokio::spawn(async move {
            if let Err(e) = write_atomic(&path_clone, &data_clone).await {
                #[cfg(debug_assertions)]
                eprintln!("[ImageCache] write failed: {}", e);
                let _ = e;
            }
        });
    } else {
        note_negative_cache(&key);
    }

    ImageResult {
        status,
        content_type,
        data,
    }
}

/* ── Maintenance commands (size / clear) ─────────────────── */

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

struct CachedImageFile {
    path: PathBuf,
    bytes: u64,
    modified: SystemTime,
}

async fn collect_cache_files(path: &Path) -> Vec<CachedImageFile> {
    let mut files = Vec::new();
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let mut entries = match fs::read_dir(&dir).await {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let Ok(file_type) = entry.file_type().await else {
                continue;
            };
            if file_type.is_dir() {
                stack.push(entry.path());
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let Ok(metadata) = entry.metadata().await else {
                continue;
            };
            files.push(CachedImageFile {
                path: entry.path(),
                bytes: metadata.len(),
                modified: metadata.modified().unwrap_or(UNIX_EPOCH),
            });
        }
    }
    files
}

async fn enforce_dir_limit(path: &Path, limit_bytes: u64) -> Result<usize, String> {
    if limit_bytes == 0 {
        return Ok(0);
    }
    let mut files = collect_cache_files(path).await;
    let mut total = files.iter().map(|file| file.bytes).sum::<u64>();
    if total <= limit_bytes {
        return Ok(0);
    }

    // Leave headroom so a cache near the boundary is not scanned and trimmed
    // after every newly downloaded cover.
    let target = limit_bytes.saturating_mul(9) / 10;
    files.sort_by_key(|file| file.modified);
    let mut removed = 0usize;
    for file in files {
        if total <= target {
            break;
        }
        if fs::remove_file(&file.path).await.is_ok() {
            total = total.saturating_sub(file.bytes);
            removed += 1;
        }
    }
    Ok(removed)
}

#[tauri::command]
pub async fn image_cache_size() -> u64 {
    let Some(state) = STATE.get() else { return 0 };
    dir_size(&state.dir).await
}

#[tauri::command]
pub async fn image_cache_clear() -> Result<(), String> {
    let Some(state) = STATE.get() else {
        return Err("image cache not ready".into());
    };
    let dir = state.dir.clone();
    if let Err(e) = fs::remove_dir_all(&dir).await
        && e.kind() != std::io::ErrorKind::NotFound {
            return Err(e.to_string());
        }
    fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn image_cache_enforce_limit(limit_mb: u64) -> Result<usize, String> {
    let Some(state) = STATE.get() else {
        return Err("image cache not ready".into());
    };
    enforce_dir_limit(&state.dir, limit_mb.saturating_mul(1024 * 1024)).await
}

#[cfg(test)]
mod maintenance_tests {
    use super::*;

    #[tokio::test]
    async fn evicts_files_until_the_image_cache_is_below_limit() {
        let unique = format!(
            "sonveil-image-cache-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let dir = std::env::temp_dir().join(unique);
        fs::create_dir_all(dir.join("aa")).await.unwrap();
        fs::write(dir.join("aa/one"), vec![1u8; 700]).await.unwrap();
        fs::write(dir.join("aa/two"), vec![2u8; 700]).await.unwrap();

        let removed = enforce_dir_limit(&dir, 1_000).await.unwrap();
        assert!(removed >= 1);
        assert!(dir_size(&dir).await <= 1_000);

        fs::remove_dir_all(&dir).await.unwrap();
    }
}
