//! Progressive + HLS downloaders for the anon SC stream path.
//!
//! Direct GETs against SoundCloud media hosts — no proxies, no retries
//! beyond what `reqwest` already handles, and no segment-level recovery
//! (a segment failure aborts the whole download so the caller can fall
//! back to the streaming server).

use bytes::{Bytes, BytesMut};
use reqwest::Client;
use url::Url;
use std::time::Duration;

const HLS_PREFETCH_SEGMENTS: usize = 3;

/// Fetch a single-file (progressive) audio stream.
pub async fn download_progressive(client: &Client, url: &str) -> Result<Bytes, String> {
    let data = fetch_bytes(client, url).await?;
    if data.is_empty() {
        return Err("progressive download returned empty body".into());
    }
    Ok(data)
}

/// Fetch + concat every segment of an HLS playlist.
pub async fn download_hls_full(client: &Client, m3u8_url: &str) -> Result<Bytes, String> {
    let m3u8_text = fetch_bytes(client, m3u8_url).await?;
    let m3u8_content = String::from_utf8_lossy(&m3u8_text);
    let (init_url, segment_urls) = parse_m3u8(&m3u8_content, m3u8_url);

    if segment_urls.is_empty() {
        return Err("No segments found in m3u8".into());
    }

    let mut buf = BytesMut::new();

    if let Some(ref init) = init_url {
        let data = fetch_bytes(client, init).await?;
        if data.windows(4).any(|w| w == b"enca") {
            return Err("unsupported stream".into());
        }
        buf.extend_from_slice(&data);
    }

    let mut inflight: Vec<tokio::task::JoinHandle<Result<Bytes, String>>> = Vec::new();
    let mut next_idx = 0usize;

    let fill_queue = |inflight: &mut Vec<tokio::task::JoinHandle<Result<Bytes, String>>>,
                      next_idx: &mut usize,
                      client: &Client,
                      urls: &[String]| {
        while *next_idx < urls.len() && inflight.len() < HLS_PREFETCH_SEGMENTS {
            let c = client.clone();
            let u = urls[*next_idx].clone();
            inflight.push(tokio::spawn(async move { fetch_bytes(&c, &u).await }));
            *next_idx += 1;
        }
    };

    fill_queue(&mut inflight, &mut next_idx, client, &segment_urls);

    while !inflight.is_empty() {
        let handle = inflight.remove(0);
        match handle.await {
            Ok(Ok(chunk)) => buf.extend_from_slice(&chunk),
            Ok(Err(e)) => return Err(format!("segment download: {e}")),
            Err(e) => return Err(format!("segment task panic: {e}")),
        }
        fill_queue(&mut inflight, &mut next_idx, client, &segment_urls);
    }

    Ok(buf.freeze())
}

pub(crate) async fn fetch_bytes(client: &Client, url: &str) -> Result<Bytes, String> {
    const HLS_BYTES_TIMEOUT_MS: u64 = 12_000;
    let resp = client
        .get(url)
        .timeout(Duration::from_millis(HLS_BYTES_TIMEOUT_MS))
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }
    tokio::time::timeout(Duration::from_millis(HLS_BYTES_TIMEOUT_MS), resp.bytes())
        .await
        .map_err(|_| "hls segment timed out".to_string())?
        .map_err(|e| format!("body: {e}"))
}

pub(crate) fn parse_m3u8(content: &str, base_url: &str) -> (Option<String>, Vec<String>) {
    let base = Url::parse(base_url).unwrap_or_else(|_| Url::parse("https://localhost").unwrap());
    let mut init_url = None;
    let mut segment_urls = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if let Some(start) = line.find("#EXT-X-MAP:URI=\"") {
            let rest = &line[start + 16..];
            if let Some(end) = rest.find('"') {
                init_url = Some(resolve_url(&rest[..end], &base));
            }
            continue;
        }
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        segment_urls.push(resolve_url(line, &base));
    }

    (init_url, segment_urls)
}

fn resolve_url(url: &str, base: &Url) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }
    base.join(url)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| url.to_string())
}
