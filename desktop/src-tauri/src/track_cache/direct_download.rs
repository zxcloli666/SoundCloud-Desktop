//! GET `/download/:urn` → JSON-список кандидатов SoundCloud. Тянем выбранного
//! напрямую с SC, наш сервер только резолвит ссылки.
//!
//! Порядок: при `hq=true` сначала hq-группа, иначе sq. Внутри группы —
//! progressive → hls. Неизвестные типы кандидатов игнорируются.

use std::future::Future;
use std::pin::Pin;

use bytes::Bytes;
use futures_util::{future::select_all, StreamExt};
use reqwest::Client;

use super::sc_anon::hls::{download_hls_full, download_progressive};
use super::state::PlaybackQuality;

#[derive(serde::Deserialize)]
pub struct DownloadResponse {
    pub candidates: Vec<Candidate>,
}

#[derive(Clone, serde::Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Candidate {
    Progressive {
        #[serde(default = "default_sq")]
        quality: String,
        #[serde(default)]
        preset: String,
        #[serde(default)]
        mime: String,
        url: String,
    },
    Hls {
        #[serde(default = "default_sq")]
        quality: String,
        #[serde(default)]
        preset: String,
        #[serde(default)]
        mime: String,
        manifest_url: String,
    },
    #[serde(other)]
    Unsupported,
}

/// Warm only the control path and the first response chunk for a future stream.
/// Dropping the response immediately keeps speculative playback cheap even when
/// an origin ignores the Range header.
pub(crate) async fn warm_candidate(client: &Client, candidate: &Candidate) -> Result<(), String> {
    const WARM_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);

    tokio::time::timeout(WARM_TIMEOUT, async {
        let request = match candidate {
            Candidate::Progressive { url, .. } => client
                .get(url)
                .header(reqwest::header::RANGE, "bytes=0-65535"),
            Candidate::Hls { manifest_url, .. } => client.get(manifest_url),
            Candidate::Unsupported => return Err("unsupported preload candidate".to_string()),
        };
        let response = request
            .send()
            .await
            .map_err(|error| format!("preload request: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("preload HTTP {}", response.status()));
        }
        let mut body = response.bytes_stream();
        match body.next().await {
            Some(Ok(_)) | None => Ok(()),
            Some(Err(error)) => Err(format!("preload body: {error}")),
        }
    })
    .await
    .map_err(|_| "preload timed out".to_string())?
}

fn default_sq() -> String {
    "sq".to_string()
}

impl Candidate {
    pub(crate) fn quality(&self) -> &str {
        match self {
            Candidate::Progressive { quality, .. } => quality,
            Candidate::Hls { quality, .. } => quality,
            Candidate::Unsupported => "unsupported",
        }
    }

    pub(crate) fn preset(&self) -> &str {
        match self {
            Candidate::Progressive { preset, .. } => preset,
            Candidate::Hls { preset, .. } => preset,
            Candidate::Unsupported => "",
        }
    }

    pub(crate) fn kind_label(&self) -> &'static str {
        match self {
            Candidate::Progressive { .. } => "progressive",
            Candidate::Hls { .. } => "hls",
            Candidate::Unsupported => "unsupported",
        }
    }

    fn kind_score(&self) -> u32 {
        match self {
            Candidate::Progressive { .. } => 0,
            Candidate::Hls { .. } => 1,
            Candidate::Unsupported => u32::MAX,
        }
    }

    pub(crate) fn playback_quality(&self) -> PlaybackQuality {
        if self.quality() == "hq" {
            PlaybackQuality::Hq
        } else {
            PlaybackQuality::Sq
        }
    }
}

pub struct DirectResult {
    pub data: Bytes,
    pub quality: PlaybackQuality,
}

pub async fn try_download(
    client: &Client,
    download_urls: &[String],
    session_id: Option<&str>,
    hq_pref: bool,
) -> Option<DirectResult> {
    if download_urls.is_empty() {
        return None;
    }

    let mut futures: Vec<Pin<Box<dyn Future<Output = Option<DirectResult>> + Send>>> =
        download_urls
            .iter()
            .map(|url| {
                let client = client.clone();
                let endpoint = url.clone();
                let session_id = session_id.map(str::to_string);
                Box::pin(async move {
                    let candidates = resolve_one_endpoint(
                        &client,
                        &endpoint,
                        session_id.as_deref(),
                        hq_pref,
                    )
                    .await
                    .ok()?;
                    consume_candidates(&client, candidates).await
                }) as Pin<Box<dyn Future<Output = Option<DirectResult>> + Send>>
            })
            .collect();

    while !futures.is_empty() {
        let (result, _idx, remaining) = select_all(futures).await;
        if result.is_some() {
            return result;
        }
        futures = remaining;
    }
    None
}

pub(crate) async fn resolve_candidates(
    client: &Client,
    download_urls: &[String],
    session_id: Option<&str>,
    hq_pref: bool,
) -> Result<Vec<Candidate>, String> {
    if download_urls.is_empty() {
        return Err("no download endpoints".to_string());
    }

    type ResolveFuture = Pin<Box<dyn Future<Output = Result<Vec<Candidate>, String>> + Send>>;
    let mut futures: Vec<ResolveFuture> = download_urls
        .iter()
        .map(|url| {
            let client = client.clone();
            let endpoint = url.clone();
            let session_id = session_id.map(str::to_string);
            Box::pin(async move {
                resolve_one_endpoint(&client, &endpoint, session_id.as_deref(), hq_pref).await
            }) as ResolveFuture
        })
        .collect();

    let mut last_error = "all download endpoints failed".to_string();
    while !futures.is_empty() {
        let (result, _idx, remaining) = select_all(futures).await;
        match result {
            Ok(candidates) if !candidates.is_empty() => return Ok(candidates),
            Ok(_) => last_error = "download endpoint returned no usable candidates".to_string(),
            Err(error) => last_error = error,
        }
        futures = remaining;
    }
    Err(last_error)
}

async fn resolve_one_endpoint(
    client: &Client,
    endpoint: &str,
    session_id: Option<&str>,
    hq_pref: bool,
) -> Result<Vec<Candidate>, String> {
    let resp = match fetch_download(client, endpoint, session_id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[direct] {endpoint} failed: {e}");
            return Err(e);
        }
    };
    let sorted = sort_candidates(resp.candidates, hq_pref);
    if sorted.is_empty() {
        println!("[direct] {endpoint} returned no usable candidates");
    } else {
        let listing = sorted
            .iter()
            .map(|c| format!("{}/{}/{}", c.kind_label(), c.quality(), c.preset()))
            .collect::<Vec<_>>()
            .join(", ");
        println!("[direct] {endpoint} candidates: [{listing}]");
    }
    Ok(sorted)
}

async fn consume_candidates(client: &Client, sorted: Vec<Candidate>) -> Option<DirectResult> {
    for cand in sorted {
        let q = cand.playback_quality();
        match consume(client, &cand).await {
            Ok(data) => {
                println!(
                    "[direct] hit {} ({} {})",
                    cand.kind_label(),
                    cand.quality(),
                    cand.preset()
                );
                return Some(DirectResult { data, quality: q });
            }
            Err(e) => {
                eprintln!(
                    "[direct] {} {} {} failed: {e}",
                    cand.kind_label(),
                    cand.quality(),
                    cand.preset()
                );
            }
        }
    }
    None
}

async fn fetch_download(
    client: &Client,
    endpoint: &str,
    session_id: Option<&str>,
) -> Result<DownloadResponse, String> {
    let (resp, hop) = crate::network::audio_route::get(client, endpoint, session_id)
        .await
        .map_err(|e| format!("request: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }
    println!("[direct] endpoint via {}", hop.tier_label());
    resp.json::<DownloadResponse>()
        .await
        .map_err(|e| format!("decode: {e}"))
}

fn sort_candidates(cands: Vec<Candidate>, hq_pref: bool) -> Vec<Candidate> {
    let mut filtered: Vec<Candidate> = cands
        .into_iter()
        .filter(|candidate| {
            !matches!(candidate, Candidate::Unsupported) && candidate.quality() != "lq"
        })
        .collect();
    filtered.sort_by_key(|c| {
        let is_hq = c.quality() == "hq";
        let q_score = if hq_pref == is_hq { 0u32 } else { 1u32 };
        (q_score, c.kind_score())
    });
    filtered
}

async fn consume(client: &Client, cand: &Candidate) -> Result<Bytes, String> {
    match cand {
        Candidate::Progressive { url, .. } => download_progressive(client, url).await,
        Candidate::Hls { manifest_url, .. } => download_hls_full(client, manifest_url).await,
        Candidate::Unsupported => Err("unsupported download candidate".to_string()),
    }
}
