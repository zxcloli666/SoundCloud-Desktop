use std::error::Error as _;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use url::Url;
use wreq::Client;

use super::state::{
    DownloadError, DownloadResult, DownloadSource, PlaybackQuality, file_len,
    write_response_to_cache,
};
use crate::app::diagnostics;
use crate::network::audio_route;
use crate::network::edge::{self, Hop};

pub(super) struct StreamJob<'a> {
    pub client: &'a Client,
    pub target_dir: &'a Path,
    pub urn: &'a str,
    pub session_id: Option<&'a str>,
    pub app_handle: Option<&'a crate::rt::AppHandle>,
    pub receiving: &'a AtomicBool,
}

pub(super) async fn download_api(
    job: &StreamJob<'_>,
    url: &str,
) -> Result<DownloadResult, DownloadError> {
    let stream_url = open_stream(job.client, url, job.session_id).await?;
    let hops = edge::audio_plan(&stream_url);
    download_over(job, &hops, quality_from_url(url)).await
}

async fn download_over(
    job: &StreamJob<'_>,
    hops: &[Hop],
    requested: PlaybackQuality,
) -> Result<DownloadResult, DownloadError> {
    let mut rest = hops;
    loop {
        let continuing = rest.len() < hops.len();
        let (response, at) = audio_route::first_answer(job.client, rest, job.session_id)
            .await
            .map_err(|err| DownloadError::Retryable(format!("request: {err}")))?;
        let hop = &rest[at];
        rest = &rest[at + 1..];
        let status = response.status();
        if continuing && matches!(status.as_u16(), 401 | 403) {
            return Err(DownloadError::Retryable(format!(
                "ticket refused on the next route ({}), minting again",
                status.as_u16()
            )));
        }
        if !status.is_success() {
            return Err(http_failure(status, response).await);
        }

        job.receiving.store(true, Ordering::Relaxed);
        let served = response
            .headers()
            .get("x-audio-quality")
            .and_then(|value| value.to_str().ok());
        let quality = match served {
            Some("hq") => PlaybackQuality::Hq,
            Some("sq") => PlaybackQuality::Sq,
            _ => requested,
        };
        let result = write_response_to_cache(
            job.target_dir,
            job.urn,
            response,
            quality,
            DownloadSource::Api,
            job.app_handle,
        )
        .await;
        match &result {
            Ok(done) => hop.note_delivered(file_len(&done.path)),
            Err(DownloadError::Retryable(err)) => {
                hop.note(false);
                if !rest.is_empty() {
                    diagnostics::warn(format!(
                        "[TrackCache] {} body via {} broke ({err}), next route",
                        job.urn,
                        hop.tier_label()
                    ));
                    continue;
                }
            }
            Err(DownloadError::Fatal(_)) => {}
        }
        return result;
    }
}

async fn open_stream(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<String, DownloadError> {
    let (response, hop) = audio_route::get_without_redirects(client, url, session_id)
        .await
        .map_err(|err| DownloadError::Retryable(format!("ticket: {err}")))?;
    let status = response.status();
    if !status.is_redirection() {
        return Err(http_failure(status, response).await);
    }

    response
        .headers()
        .get(wreq::header::LOCATION)
        .and_then(|location| location.to_str().ok())
        .and_then(|location| Url::parse(&hop.url).ok()?.join(location).ok())
        .map(String::from)
        .ok_or_else(|| DownloadError::Retryable("ticket: redirect without location".into()))
}

async fn http_failure(status: wreq::StatusCode, response: wreq::Response) -> DownloadError {
    let body = match response.text().await {
        Ok(body) => normalize_error_body(&body),
        Err(err) => Some(format!(
            "failed to read response body: {}",
            format_reqwest_error(err)
        )),
    };
    let message = if let Some(body) = body {
        format!("HTTP {}: {}", status, body)
    } else {
        format!("HTTP {}", status)
    };
    if status.is_client_error() && !matches!(status.as_u16(), 408 | 421 | 429) {
        DownloadError::Fatal(message)
    } else {
        DownloadError::Retryable(message)
    }
}

fn quality_from_url(url: &str) -> PlaybackQuality {
    if Url::parse(url)
        .ok()
        .map(|parsed| {
            parsed
                .query_pairs()
                .any(|(key, value)| key == "hq" && value == "true")
        })
        .unwrap_or(false)
    {
        PlaybackQuality::Hq
    } else {
        PlaybackQuality::Sq
    }
}

fn truncate_error_text(text: &str, max_chars: usize) -> String {
    let truncated: String = text.chars().take(max_chars).collect();
    if text.chars().count() > max_chars {
        format!("{}...", truncated.trim_end())
    } else {
        truncated
    }
}

fn extract_json_error(value: &serde_json::Value) -> Option<String> {
    if let Some(message) = value.get("message").and_then(|v| v.as_str()) {
        return Some(message.to_string());
    }
    if let Some(error) = value.get("error").and_then(|v| v.as_str()) {
        return Some(error.to_string());
    }
    if let Some(errors) = value.get("errors").and_then(|v| v.as_array()) {
        let parts = errors
            .iter()
            .filter_map(|entry| {
                entry
                    .get("error_message")
                    .and_then(|v| v.as_str())
                    .or_else(|| entry.get("message").and_then(|v| v.as_str()))
                    .or_else(|| entry.get("error").and_then(|v| v.as_str()))
                    .map(str::to_string)
            })
            .collect::<Vec<_>>();
        if !parts.is_empty() {
            return Some(parts.join("; "));
        }
    }
    None
}

fn normalize_error_body(body: &str) -> Option<String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return None;
    }

    let compact = if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        extract_json_error(&value).unwrap_or_else(|| value.to_string())
    } else {
        trimmed.to_string()
    };

    let single_line = compact.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.is_empty() {
        None
    } else {
        Some(truncate_error_text(&single_line, 220))
    }
}

fn format_reqwest_error(err: wreq::Error) -> String {
    let mut details = Vec::new();
    if err.is_timeout() {
        details.push("timeout".to_string());
    } else if err.is_connect() {
        details.push("connect".to_string());
    } else if err.is_redirect() {
        details.push("redirect".to_string());
    } else if err.is_body() {
        details.push("body".to_string());
    } else if err.is_decode() {
        details.push("decode".to_string());
    } else if err.is_request() {
        details.push("request".to_string());
    }

    if let Some(status) = err.status() {
        details.push(format!("HTTP {status}"));
    }

    let mut causes = Vec::new();
    let mut source = err.source();
    while let Some(next) = source {
        let text = next.to_string();
        if !text.is_empty() && !causes.iter().any(|existing| existing == &text) {
            causes.push(text);
        }
        source = next.source();
    }

    let mut message = err.without_uri().to_string();
    if !details.is_empty() {
        message.push_str(&format!(" [{}]", details.join(", ")));
    }
    if !causes.is_empty() {
        message.push_str(&format!(": {}", causes.join(": ")));
    }
    message
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicBool;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use warp::Filter;

    use super::{StreamJob, download_over};
    use crate::network::edge::{Hop, Tier};
    use crate::track_cache::state::{DownloadError, PlaybackQuality};

    const FULL: usize = 200 * 1024;

    fn audio(len: usize) -> Vec<u8> {
        let mut body = b"ID3".to_vec();
        body.resize(len, 0);
        body
    }

    async fn cut_after(bytes: usize) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                let mut request = [0u8; 4096];
                let _ = socket.read(&mut request).await;
                let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {FULL}\r\n\r\n");
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(&audio(bytes)).await;
            }
        });
        format!("http://{addr}/stream")
    }

    fn whole() -> String {
        let route = warp::path("stream").map(|| audio(FULL));
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        format!("http://{addr}/stream")
    }

    fn refusing() -> String {
        let route = warp::path("stream").map(|| {
            warp::reply::with_status("ticket expired", warp::http::StatusCode::UNAUTHORIZED)
        });
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        format!("http://{addr}/stream")
    }

    fn hop(url: String, tier: Tier) -> Hop {
        Hop {
            url,
            tier,
            origin: "cut.test.invalid".to_string(),
        }
    }

    async fn fetch_over(hops: &[Hop]) -> Result<u64, DownloadError> {
        let dir = std::env::temp_dir().join(format!("sc-cut-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let client = wreq::Client::new();
        let receiving = AtomicBool::new(false);
        let job = StreamJob {
            client: &client,
            target_dir: &dir,
            urn: "soundcloud:tracks:1",
            session_id: None,
            app_handle: None,
            receiving: &receiving,
        };
        let done = download_over(&job, hops, PlaybackQuality::Sq).await;
        let size = done.map(|done| std::fs::metadata(done.path).unwrap().len());
        std::fs::remove_dir_all(dir).unwrap();
        size
    }

    #[tokio::test]
    async fn a_body_cut_on_the_direct_route_is_fetched_again_through_the_relay() {
        let hops = [
            hop(cut_after(16 * 1024).await, Tier::Direct),
            hop(whole(), Tier::Relay),
        ];
        assert_eq!(fetch_over(&hops).await.ok(), Some(FULL as u64));
    }

    #[tokio::test]
    async fn a_ticket_refused_on_the_next_route_is_minted_again() {
        let hops = [
            hop(cut_after(16 * 1024).await, Tier::Direct),
            hop(refusing(), Tier::Relay),
        ];
        assert!(matches!(
            fetch_over(&hops).await,
            Err(DownloadError::Retryable(_))
        ));
    }
}
