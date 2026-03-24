use std::path::PathBuf;
use std::sync::OnceLock;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use sha2::{Digest, Sha256};
use tokio::fs;

use crate::shared::constants::{is_domain_whitelisted, PROXY_URL};

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

fn cache_meta_path(cache_path: &std::path::Path) -> PathBuf {
    PathBuf::from(format!("{}.meta", cache_path.display()))
}

async fn read_cached_asset(cache_path: &std::path::Path) -> Option<(String, Vec<u8>)> {
    let meta_path = cache_meta_path(cache_path);
    let (content_type_raw, data) = tokio::join!(fs::read_to_string(&meta_path), fs::read(cache_path));

    let content_type = content_type_raw.ok()?.trim().to_string();
    let data = data.ok()?;

    if content_type.is_empty() || data.is_empty() {
        let _ = fs::remove_file(cache_path).await;
        let _ = fs::remove_file(meta_path).await;
        return None;
    }

    Some((content_type, data))
}

async fn write_cached_asset(cache_path: PathBuf, content_type: String, data: Vec<u8>) {
    let tmp_suffix = format!(".tmp-{}", std::process::id());
    let tmp_cache_path = PathBuf::from(format!("{}{}", cache_path.display(), tmp_suffix));
    let meta_path = cache_meta_path(&cache_path);
    let tmp_meta_path = PathBuf::from(format!("{}{}", meta_path.display(), tmp_suffix));

    if fs::write(&tmp_cache_path, &data).await.is_err() {
        let _ = fs::remove_file(&tmp_cache_path).await;
        return;
    }

    if fs::write(&tmp_meta_path, content_type.as_bytes()).await.is_err() {
        let _ = fs::remove_file(&tmp_cache_path).await;
        let _ = fs::remove_file(&tmp_meta_path).await;
        return;
    }

    if fs::rename(&tmp_cache_path, &cache_path).await.is_err() {
        let _ = fs::remove_file(&tmp_cache_path).await;
        let _ = fs::remove_file(&tmp_meta_path).await;
        return;
    }

    if fs::rename(&tmp_meta_path, &meta_path).await.is_err() {
        let _ = fs::remove_file(&cache_path).await;
        let _ = fs::remove_file(&tmp_meta_path).await;
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
    let target_url = match BASE64.decode(decoded.as_bytes()) {
        Ok(bytes) => match String::from_utf8(bytes) {
            Ok(s) => s,
            Err(_) => {
                return ProxyResult {
                    status: 400,
                    content_type: "text/plain".into(),
                    data: b"invalid utf8".to_vec(),
                }
            }
        },
        Err(_) => {
            return ProxyResult {
                status: 400,
                content_type: "text/plain".into(),
                data: b"invalid base64".to_vec(),
            }
        }
    };

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

    let key = cache_key(&target_url);
    let cache_path = state.assets_dir.join(&key);
    if cache_path.exists() {
        if let Some((content_type, data)) = read_cached_asset(&cache_path).await {
            #[cfg(debug_assertions)]
            println!("[Proxy] cache HIT {}", target_url);
            return ProxyResult {
                status: 200,
                content_type,
                data,
            };
        }
    }

    #[cfg(debug_assertions)]
    println!("[Proxy] {} -> upstream", target_url);

    let encoded_for_header = BASE64.encode(target_url.as_bytes());
    let mut status = 502u16;
    let mut content_type = String::new();
    let mut data: Vec<u8> = Vec::new();

    for attempt in 0..3u8 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(500 * attempt as u64)).await;
        }

        let resp = match state
            .http_client
            .get(PROXY_URL)
            .header("X-Target", &encoded_for_header)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => continue,
        };

        status = resp.status().as_u16();
        content_type = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        match resp.bytes().await {
            Ok(b) => data = b.to_vec(),
            Err(_) => continue,
        }

        if status < 500 {
            break;
        }
    }

    let is_cacheable = status == 200
        && !content_type.starts_with("text/html")
        && !content_type.starts_with("text/plain")
        && !content_type.is_empty();
    if is_cacheable {
        let data_clone = data.clone();
        let path = cache_path.clone();
        let content_type_clone = content_type.clone();
        tokio::spawn(async move {
            write_cached_asset(path, content_type_clone, data_clone).await;
        });
    }

    ProxyResult {
        status,
        content_type,
        data,
    }
}

pub async fn handle_uri(request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let encoded = request.uri().path().trim_start_matches('/');
    let result = proxy_request(encoded).await;
    http::Response::builder()
        .status(result.status)
        .header("content-type", &result.content_type)
        .header("access-control-allow-origin", "*")
        .body(result.data)
        .unwrap()
}
