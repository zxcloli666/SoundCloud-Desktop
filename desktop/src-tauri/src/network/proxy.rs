use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use sha2::{Digest, Sha256};
use tokio::fs;

use crate::network::edge::{self, Hop};
use crate::shared::constants::is_domain_whitelisted;

const MAX_PROXY_HOPS: usize = 3;
const PROXY_TOTAL_TIMEOUT: Duration = Duration::from_secs(18);
const PROXY_HOP_TIMEOUT: Duration = Duration::from_secs(6);
const PROXY_HOP_BODY_TIMEOUT: Duration = Duration::from_secs(12);
static CACHE_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub struct State {
    pub assets_dir: PathBuf,
    pub http_client: reqwest::Client,
    pub rt_handle: tokio::runtime::Handle,
}

pub static STATE: OnceLock<State> = OnceLock::new();

pub struct ProxyResult {
    pub status: u16,
    pub content_type: String,
    pub data: Vec<u8>,
}

fn cache_key(url: &str) -> String {
    hex::encode(Sha256::digest(url.as_bytes()))
}

fn bounded_proxy_hops(hops: Vec<Hop>) -> Vec<Hop> {
    let Some(first) = hops.first() else {
        return Vec::new();
    };
    if hops.len() <= MAX_PROXY_HOPS {
        return hops;
    }

    let mut selected = Vec::with_capacity(MAX_PROXY_HOPS);
    selected.push(first.clone());
    if let Some(alternate) = hops.iter().skip(1).find(|hop| hop.tier != first.tier) {
        selected.push(alternate.clone());
    }
    for hop in hops.iter().skip(1) {
        if selected.len() >= MAX_PROXY_HOPS {
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

/// Sniff the content type from the leading bytes. Single source of truth so we
/// don't need a sidecar .meta file on disk.
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
    } else if data.len() >= 4 && data[..4] == [0x00, 0x00, 0x01, 0x00] {
        "image/x-icon"
    } else if data.len() >= 5 && (&data[..5] == b"<?xml" || &data[..4] == b"<svg") {
        "image/svg+xml"
    } else {
        "application/octet-stream"
    }
}

async fn write_cached_asset(cache_path: PathBuf, data: Vec<u8>) {
    let sequence = CACHE_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let tmp = PathBuf::from(format!(
        "{}.tmp-{}-{}",
        cache_path.display(),
        std::process::id(),
        sequence,
    ));
    if fs::write(&tmp, &data).await.is_err() {
        let _ = fs::remove_file(&tmp).await;
        return;
    }
    if fs::rename(&tmp, &cache_path).await.is_err() {
        let _ = fs::remove_file(&tmp).await;
    }
}

pub async fn proxy_request(encoded: &str) -> ProxyResult {
    let state = match STATE.get() {
        Some(s) => s,
        None => {
            return ProxyResult {
                status: 503,
                content_type: "text/plain".into(),
                data: b"not ready".to_vec(),
            }
        }
    };

    let decoded = urlencoding::decode(encoded).unwrap_or_default();
    let payload_bytes = match BASE64.decode(decoded.as_bytes()) {
        Ok(bytes) => bytes,
        Err(_) => {
            return ProxyResult {
                status: 400,
                content_type: "text/plain".into(),
                data: b"invalid base64".to_vec(),
            }
        }
    };

    let payload: Vec<String> = match serde_json::from_slice(&payload_bytes) {
        Ok(v) => v,
        Err(_) => {
            return ProxyResult {
                status: 400,
                content_type: "text/plain".into(),
                data: b"invalid payload".to_vec(),
            }
        }
    };

    let target_url = match payload.first() {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return ProxyResult {
                status: 400,
                content_type: "text/plain".into(),
                data: b"missing target".to_vec(),
            }
        }
    };
    let upstreams = &payload[1..];
    if upstreams.is_empty() {
        return ProxyResult {
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
        return ProxyResult {
            status: 403,
            content_type: "text/plain".into(),
            data: b"whitelisted domain".to_vec(),
        };
    }

    let cache_path = state.assets_dir.join(cache_key(&target_url));

    if let Ok(data) = fs::read(&cache_path).await {
        if !data.is_empty() {
            #[cfg(debug_assertions)]
            println!("[Proxy] cache HIT {}", target_url);
            let content_type = sniff_content_type(&data).to_string();
            return ProxyResult {
                status: 200,
                content_type,
                data,
            };
        }
        let _ = fs::remove_file(&cache_path).await;
    }

    #[cfg(debug_assertions)]
    println!("[Proxy] {} -> upstream", target_url);

    let encoded_for_header = BASE64.encode(target_url.as_bytes());
    let mut status = 502u16;
    let mut data: Vec<u8> = Vec::new();
    let deadline = Instant::now() + PROXY_TOTAL_TIMEOUT;

    for hop in bounded_proxy_hops(edge::expand_upstreams(upstreams)) {
        let Some(header_budget) = deadline_budget(deadline, PROXY_HOP_TIMEOUT) else {
            status = 504;
            break;
        };

        // `direct` = fetch the target ourselves with a browser User-Agent
        // (hosts like wallhaven/konachan 403 a non-browser UA). Otherwise relay
        // the request to the proxy upstream via the X-Target header.
        let builder = if hop.url == "direct" {
            state
                .http_client
                .get(target_url.as_str())
                .header("User-Agent", crate::network::wallpapers::BROWSER_UA)
        } else {
            state
                .http_client
                .get(&hop.url)
                .header("X-Target", &encoded_for_header)
        };
        let resp = match tokio::time::timeout(header_budget, builder.send()).await {
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
        let Some(body_budget) = deadline_budget(deadline, PROXY_HOP_BODY_TIMEOUT) else {
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

    let is_cacheable = status == 200 && !data.is_empty() && content_type.starts_with("image/");
    if is_cacheable {
        let data_clone = data.clone();
        let path = cache_path.clone();
        tokio::spawn(async move {
            write_cached_asset(path, data_clone).await;
        });
    }

    ProxyResult {
        status,
        content_type,
        data,
    }
}

/// Long browser cache for successful image responses. Image URLs are
/// content-addressable (sndcdn artwork-XXX), so effectively immutable. Without
/// this the WebView re-hits the proxy on every render and the disk cache only
/// saves a network roundtrip — not the disk read.
pub fn cache_control_for(status: u16) -> &'static str {
    if status == 200 {
        "public, max-age=31536000, immutable"
    } else {
        "no-store"
    }
}

pub async fn handle_uri(request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let path = request.uri().path();

    if let Some(encoded) = path.strip_prefix("/img/") {
        let result = crate::network::image_cache::handle(encoded).await;
        return http::Response::builder()
            .status(result.status)
            .header("content-type", &result.content_type)
            .header("cache-control", cache_control_for(result.status))
            .header("access-control-allow-origin", "*")
            .body(result.data)
            .unwrap();
    }

    let encoded = path.trim_start_matches('/');
    let result = proxy_request(encoded).await;
    http::Response::builder()
        .status(result.status)
        .header("content-type", &result.content_type)
        .header("cache-control", cache_control_for(result.status))
        .header("access-control-allow-origin", "*")
        .body(result.data)
        .unwrap()
}
