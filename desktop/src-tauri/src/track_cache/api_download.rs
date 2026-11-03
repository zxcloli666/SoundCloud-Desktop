use std::error::Error as _;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use url::Url;
use wreq::Client;

use super::state::{
    DownloadError, DownloadResult, DownloadSource, PlaybackQuality, REFUSAL_TTL, file_len,
    write_response_to_cache,
};
use crate::app::diagnostics;
use crate::network::audio_route;
use crate::network::edge::{self, Hop};

const SESSION_NOT_SEEN: &str = "Missing or malformed x-session-id";

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
    let stream_url = match open_stream(job.client, url, job.session_id).await {
        Err(DownloadError::Fatal(err)) if err.contains(SESSION_NOT_SEEN) => {
            let session = crate::auth::session_token(job.app_handle).await;
            let Some(session) = session.as_deref().or(job.session_id) else {
                return Err(DownloadError::Fatal(err));
            };
            diagnostics::warn(format!(
                "[TrackCache] {} api did not see the session, asking once more",
                job.urn
            ));
            open_stream(job.client, url, Some(session)).await?
        }
        opened => opened?,
    };
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
        let quality = served.and_then(PlaybackQuality::parse).unwrap_or(requested);
        let result = write_response_to_cache(
            job.target_dir,
            job.urn,
            response,
            hop,
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

pub(super) async fn http_failure(
    status: wreq::StatusCode,
    response: wreq::Response,
) -> DownloadError {
    let wait = retry_after(&response).filter(|_| status == wreq::StatusCode::TOO_MANY_REQUESTS);
    let body = match response.text().await {
        Ok(body) => normalize_error_body(&body),
        Err(err) => Some(format!(
            "failed to read response body: {}",
            format_reqwest_error(err)
        )),
    };
    let head = match wait {
        Some(secs) => format!("HTTP {status}, retry after {secs} s"),
        None => format!("HTTP {status}"),
    };
    let message = match body {
        Some(body) => format!("{head}: {body}"),
        None => head,
    };
    let fatal = status.is_client_error() && !matches!(status.as_u16(), 408 | 421 | 429);
    if fatal || wait.is_some() {
        DownloadError::Fatal(message)
    } else {
        DownloadError::Retryable(message)
    }
}

fn retry_after(response: &wreq::Response) -> Option<u64> {
    response
        .headers()
        .get(wreq::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse()
        .ok()
}

pub(super) fn refused_for(err: &str) -> Option<Duration> {
    if err.starts_with("HTTP 403 ") {
        return Some(REFUSAL_TTL);
    }
    let wait = err
        .strip_prefix("HTTP 429 ")?
        .split_once(", retry after ")?
        .1;
    let secs = wait.split_once(' ')?.0.parse().ok()?;
    Some(Duration::from_secs(secs))
}

pub(super) fn refused_by_both(a: Option<Duration>, b: Option<Duration>) -> Option<Duration> {
    a.zip(b).map(|(a, b)| a.max(b))
}

fn quality_from_url(url: &str) -> PlaybackQuality {
    let Ok(parsed) = Url::parse(url) else {
        return PlaybackQuality::Sq;
    };
    let asked = parsed
        .query_pairs()
        .find(|(key, _)| key == "quality")
        .and_then(|(_, value)| PlaybackQuality::parse(&value));
    let hq = parsed
        .query_pairs()
        .any(|(key, value)| key == "hq" && value == "true");
    match asked {
        Some(tier) => tier,
        None if hq => PlaybackQuality::Hq,
        None => PlaybackQuality::Sq,
    }
}

pub(super) fn tier_url(url: &str, tier: PlaybackQuality) -> String {
    let Ok(mut parsed) = Url::parse(url) else {
        return url.to_string();
    };
    let kept: Vec<(String, String)> = parsed
        .query_pairs()
        .filter(|(key, _)| key != "hq" && key != "quality")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    {
        let mut query = parsed.query_pairs_mut();
        query.clear();
        for (key, value) in &kept {
            query.append_pair(key, value);
        }
        if tier.rank() > PlaybackQuality::Sq.rank() {
            query.append_pair("hq", "true");
        }
        query.append_pair("quality", tier.label());
    }
    parsed.to_string()
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
    use std::net::SocketAddr;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::time::Duration;

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use warp::{Filter, Reply};

    use super::{StreamJob, download_api, download_over};
    use crate::network::edge::{Hop, Tier};
    use crate::track_cache::state::{DownloadError, PlaybackQuality, REFUSAL_TTL};

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

    fn forbidding() -> String {
        let route = warp::path("stream")
            .map(|| warp::reply::with_status("forbidden", warp::http::StatusCode::FORBIDDEN));
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        format!("http://{addr}/stream")
    }

    fn busy(retry_after: Option<&'static str>) -> String {
        let route = warp::path("stream").map(move || {
            let reply =
                warp::reply::with_status("free hq busy", warp::http::StatusCode::TOO_MANY_REQUESTS);
            match retry_after {
                Some(secs) => warp::reply::with_header(reply, "retry-after", secs).into_response(),
                None => reply.into_response(),
            }
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
        fetch_through(&wreq::Client::new(), hops).await
    }

    async fn fetch_through(client: &wreq::Client, hops: &[Hop]) -> Result<u64, DownloadError> {
        let dir = std::env::temp_dir().join(format!("sc-cut-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let receiving = AtomicBool::new(false);
        let job = StreamJob {
            client,
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

    async fn stalling_once(before: usize, pause: Duration) -> (SocketAddr, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let accepted = Arc::new(AtomicUsize::new(0));
        let counted = accepted.clone();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                counted.fetch_add(1, Ordering::SeqCst);
                let mut request = [0u8; 4096];
                let _ = socket.read(&mut request).await;
                let head = format!("HTTP/1.1 200 OK\r\nContent-Length: {FULL}\r\n\r\n");
                let body = audio(FULL);
                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(&body[..before]).await;
                tokio::time::sleep(pause).await;
                let _ = socket.write_all(&body[before..]).await;
            }
        });
        (addr, accepted)
    }

    fn counted() -> (String, Arc<AtomicUsize>) {
        let asked = Arc::new(AtomicUsize::new(0));
        let counter = asked.clone();
        let route = warp::path("stream").map(move || {
            counter.fetch_add(1, Ordering::SeqCst);
            audio(FULL)
        });
        let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        (format!("http://{addr}/stream"), asked)
    }

    #[tokio::test]
    async fn a_relay_that_stalls_mid_body_keeps_its_download_to_the_end() {
        let host = "stream.r-held.relay.scnative.dev";
        let (addr, accepted) = stalling_once(64 * 1024, Duration::from_millis(4300)).await;
        let (next, asked) = counted();
        let client = wreq::Client::builder().resolve(host, addr).build().unwrap();
        let hops = [
            hop(format!("http://{host}:{}/stream", addr.port()), Tier::Relay),
            hop(next, Tier::Relay),
        ];
        assert_eq!(fetch_through(&client, &hops).await.ok(), Some(FULL as u64));
        assert_eq!(accepted.load(Ordering::SeqCst), 1);
        assert_eq!(asked.load(Ordering::SeqCst), 0);
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

    #[tokio::test]
    async fn a_session_the_api_did_not_see_is_sent_once_more() {
        let asked = Arc::new(AtomicUsize::new(0));
        let counted = asked.clone();
        let ticket = warp::path("ticket").map(move || {
            if counted.fetch_add(1, Ordering::SeqCst) == 0 {
                let refusal = warp::reply::json(&serde_json::json!({
                    "message": "Missing or malformed x-session-id header"
                }));
                return warp::reply::with_status(refusal, warp::http::StatusCode::UNAUTHORIZED)
                    .into_response();
            }
            warp::redirect::temporary(warp::http::Uri::from_static("/stream")).into_response()
        });
        let stream = warp::path("stream").map(|| audio(FULL));
        let (addr, server) = warp::serve(ticket.or(stream)).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);

        let dir = std::env::temp_dir().join(format!("sc-session-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let client = wreq::Client::new();
        let receiving = AtomicBool::new(false);
        let job = StreamJob {
            client: &client,
            target_dir: &dir,
            urn: "soundcloud:tracks:1",
            session_id: Some("5b0c3a4e-3f0e-4a8e-9f3e-0c1d2e3f4a5b"),
            app_handle: None,
            receiving: &receiving,
        };
        let done = download_api(&job, &format!("http://{addr}/ticket")).await;
        std::fs::remove_dir_all(dir).unwrap();

        assert!(done.is_ok());
        assert_eq!(asked.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn only_a_403_from_the_server_reads_as_a_refused_tier() {
        let refused = match fetch_over(&[hop(forbidding(), Tier::Direct)]).await {
            Err(DownloadError::Fatal(err)) => err,
            _ => panic!("a 403 must be fatal"),
        };
        assert_eq!(super::refused_for(&refused), Some(REFUSAL_TTL), "{refused}");

        let hops = [
            hop(cut_after(16 * 1024).await, Tier::Direct),
            hop(refusing(), Tier::Relay),
        ];
        let Err(DownloadError::Retryable(minted)) = fetch_over(&hops).await else {
            panic!("a ticket refused on the next route is retried");
        };
        assert_eq!(super::refused_for(&minted), None, "{minted}");
    }

    #[tokio::test]
    async fn a_busy_429_refuses_the_tier_for_its_retry_after() {
        let busy_for = match fetch_over(&[hop(busy(Some("90")), Tier::Direct)]).await {
            Err(DownloadError::Fatal(err)) => err,
            _ => panic!("a 429 with retry-after is not retried at once"),
        };
        assert_eq!(
            super::refused_for(&busy_for),
            Some(Duration::from_secs(90)),
            "{busy_for}"
        );

        let Err(DownloadError::Retryable(bare)) =
            fetch_over(&[hop(busy(None), Tier::Direct)]).await
        else {
            panic!("a 429 without retry-after is retried");
        };
        assert_eq!(super::refused_for(&bare), None, "{bare}");
    }

    #[test]
    fn a_tier_replaces_whatever_quality_the_url_carried() {
        use super::{quality_from_url, tier_url};
        let base = "https://api.example/tracks/soundcloud%3Atracks%3A1/stream?hq=true";
        let uq = tier_url(base, PlaybackQuality::Uq);
        assert_eq!(
            uq,
            "https://api.example/tracks/soundcloud%3Atracks%3A1/stream?hq=true&quality=uq"
        );
        assert_eq!(quality_from_url(&uq).label(), "uq");
        let sq = tier_url(&uq, PlaybackQuality::Sq);
        assert_eq!(
            sq,
            "https://api.example/tracks/soundcloud%3Atracks%3A1/stream?quality=sq"
        );
        assert_eq!(quality_from_url(base).label(), "hq");
    }
}
