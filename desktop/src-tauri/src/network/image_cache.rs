use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant, SystemTime};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::stream::{FuturesUnordered, StreamExt};
use sha2::{Digest, Sha256};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

use crate::app::diagnostics;
use crate::network::edge::{self, Hop};
use crate::network::fail;
use crate::network::netcheck::model::Role;
use crate::network::netcheck::paths;
use crate::shared::constants::is_domain_whitelisted;
use crate::shared::file_lru::{last_used, mark_used};

pub mod maintenance;

const SOURCE: &str = "image";
const HEDGE_DELAY: Duration = Duration::from_millis(300);

/// Permanent on-disk image cache.
///
/// Lives in `app_data_dir/images/` (NOT cache_dir) so the OS never reclaims
/// the files. The directory is sharded by the first two hex chars of the
/// SHA256 key so we never end up with hundreds of thousands of entries in
/// a single directory.
pub struct ImageCache {
    pub dir: PathBuf,
    pub http_client: wreq::Client,
}

pub static STATE: OnceLock<ImageCache> = OnceLock::new();

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

/// Atomic write: tmp -> fsync -> rename. Survives crashes — we either have
/// the old file or the fully-written new one, never a partial blob.
async fn write_atomic(path: &Path, data: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let tmp = path.with_extension(format!("tmp-{}", std::process::id()));
    {
        let mut f = File::create(&tmp).await?;
        f.write_all(data).await?;
        f.sync_all().await?;
    }
    if let Err(e) = fs::rename(&tmp, path).await {
        let _ = fs::remove_file(&tmp).await;
        return Err(e);
    }
    Ok(())
}

const MARK_USED_INTERVAL: Duration = Duration::from_secs(60 * 60);

fn used_recently(path: &Path) -> bool {
    std::fs::metadata(path)
        .ok()
        .and_then(|meta| SystemTime::now().duration_since(last_used(&meta)).ok())
        .is_some_and(|age| age < MARK_USED_INTERVAL)
}

pub(crate) fn spawn_mark_used(path: PathBuf) {
    tokio::task::spawn_blocking(move || {
        if !used_recently(&path) {
            mark_used(&path);
        }
    });
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
            spawn_mark_used(path);
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

    let encoded_for_header = BASE64.encode(target_url.as_bytes());
    let hops = edge::expand_upstreams(upstreams);
    let (status, data) = first_delivered(&state.http_client, &hops, &encoded_for_header).await;

    let content_type = if status == 200 && !data.is_empty() {
        sniff_content_type(&data).to_string()
    } else {
        String::new()
    };

    if status == 200 && !data.is_empty() && content_type.starts_with("image/") {
        let path_clone = path.clone();
        let data_clone = data.clone();
        tokio::spawn(async move {
            if let Err(e) = write_atomic(&path_clone, &data_clone).await {
                diagnostics::warn(format!("[ImageCache] write failed: {e}"));
            }
        });
    }

    ImageResult {
        status,
        content_type,
        data,
    }
}

async fn first_delivered(client: &wreq::Client, hops: &[Hop], target: &str) -> (u16, Vec<u8>) {
    let mut attempts = FuturesUnordered::new();
    let mut status = 502;
    let mut next = 0;
    while next < hops.len() || !attempts.is_empty() {
        if attempts.is_empty() {
            attempts.push(fetch(client, &hops[next], Role::of_index(next), target));
            next += 1;
        }
        tokio::select! {
            Some(result) = attempts.next() => match result {
                Ok(delivered) => return delivered,
                Err(failed) => status = failed,
            },
            () = tokio::time::sleep(HEDGE_DELAY), if next < hops.len() => {
                attempts.push(fetch(client, &hops[next], Role::Hedge, target));
                next += 1;
            }
        }
    }
    (status, Vec::new())
}

async fn fetch(
    client: &wreq::Client,
    hop: &Hop,
    role: Role,
    target: &str,
) -> Result<(u16, Vec<u8>), u16> {
    let started = Instant::now();
    let record = |outcome| paths::record(hop, role, outcome, started.elapsed(), SOURCE);
    let failed = |error: wreq::Error| {
        record(Err(fail::of_wreq(&error)));
        hop.note(false);
        502u16
    };
    let request = client.get(&hop.url).header("X-Target", target);
    let response = request.send().await.map_err(failed)?;
    let status = response.status().as_u16();
    if !edge::hop_ok(hop, &response) {
        record(Ok(status));
        return Err(status);
    }
    let data = response.bytes().await.map_err(failed)?;
    record(Ok(status));
    hop.note(status < 500);
    if status >= 500 {
        return Err(status);
    }
    hop.note_delivered(data.len() as u64);
    Ok((status, data.to_vec()))
}
