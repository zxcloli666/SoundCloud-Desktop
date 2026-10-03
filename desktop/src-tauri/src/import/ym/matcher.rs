use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::Deserialize;
use wreq::StatusCode;

use super::yandex::YmTrack;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_RETRIES: u32 = 3;
const DEFAULT_RETRY_AFTER_SECS: u64 = 5;
const MAX_RETRY_AFTER_SECS: u64 = 120;
const SLEEP_STEP: Duration = Duration::from_millis(250);

pub enum Outcome {
    Found {
        urn: String,
        confidence: Option<f64>,
    },
    Uncertain,
    NotFound,
    Failed,
    Cancelled,
}

#[derive(Deserialize)]
struct MatchResponse {
    #[serde(rename = "match")]
    best: Option<MatchHit>,
    #[serde(default)]
    candidates: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct MatchHit {
    urn: String,
    confidence: Option<f64>,
}

#[derive(Deserialize)]
struct LegacyResponse {
    collection: Vec<LegacyTrack>,
}

#[derive(Deserialize)]
struct LegacyTrack {
    urn: Option<String>,
}

enum Reply {
    Done(Outcome),
    RateLimited(Duration),
    Retryable,
    MatchMissing,
}

pub struct Matcher<'a> {
    client: wreq::Client,
    backend_url: String,
    session_id: String,
    cancel: &'a AtomicBool,
    legacy: bool,
}

impl<'a> Matcher<'a> {
    pub fn new(
        client: wreq::Client,
        backend_url: String,
        session_id: String,
        cancel: &'a AtomicBool,
    ) -> Self {
        Self {
            client,
            backend_url,
            session_id,
            cancel,
            legacy: false,
        }
    }

    pub async fn find(&mut self, track: &YmTrack) -> Outcome {
        let mut failures = 0;
        loop {
            if self.cancel.load(Ordering::Relaxed) {
                return Outcome::Cancelled;
            }
            let reply = if self.legacy {
                self.legacy_search(track).await
            } else {
                self.match_track(track).await
            };
            match reply {
                Reply::Done(outcome) => return outcome,
                Reply::MatchMissing => self.legacy = true,
                Reply::RateLimited(wait) => {
                    if !self.sleep(wait).await {
                        return Outcome::Cancelled;
                    }
                }
                Reply::Retryable => {
                    failures += 1;
                    if failures > MAX_RETRIES {
                        return Outcome::Failed;
                    }
                    if !self.sleep(Duration::from_secs(1 << (failures - 1))).await {
                        return Outcome::Cancelled;
                    }
                }
            }
        }
    }

    async fn match_track(&self, track: &YmTrack) -> Reply {
        let mut url = format!(
            "{}/search/match?artist={}&title={}",
            self.backend_url,
            urlencoding::encode(track.primary_artist()),
            urlencoding::encode(&track.title),
        );
        if let Some(ms) = track.duration_ms {
            url.push_str(&format!("&duration_ms={ms}"));
        }
        let response = match self.send(&url).await {
            Ok(response) => response,
            Err(reply) => return reply,
        };
        if response.status() == StatusCode::NOT_FOUND {
            return Reply::MatchMissing;
        }
        match response.json::<MatchResponse>().await {
            Ok(MatchResponse {
                best: Some(hit), ..
            }) => Reply::Done(Outcome::Found {
                urn: hit.urn,
                confidence: hit.confidence,
            }),
            Ok(MatchResponse { candidates, .. }) if !candidates.is_empty() => {
                Reply::Done(Outcome::Uncertain)
            }
            Ok(_) => Reply::Done(Outcome::NotFound),
            Err(_) => Reply::Retryable,
        }
    }

    async fn legacy_search(&self, track: &YmTrack) -> Reply {
        let query = format!("{} {}", track.primary_artist(), track.title);
        let url = format!(
            "{}/tracks?q={}&limit=3&linked_partitioning=true",
            self.backend_url,
            urlencoding::encode(query.trim()),
        );
        let response = match self.send(&url).await {
            Ok(response) => response,
            Err(reply) => return reply,
        };
        match response.json::<LegacyResponse>().await {
            Ok(results) => match results.collection.into_iter().find_map(|t| t.urn) {
                Some(urn) => Reply::Done(Outcome::Found {
                    urn,
                    confidence: None,
                }),
                None => Reply::Done(Outcome::NotFound),
            },
            Err(_) => Reply::Retryable,
        }
    }

    async fn send(&self, url: &str) -> Result<wreq::Response, Reply> {
        let response = self
            .client
            .get(url)
            .header("x-session-id", &self.session_id)
            .header("x-search-intent", "import")
            .timeout(REQUEST_TIMEOUT)
            .send()
            .await
            .map_err(|_| Reply::Retryable)?;
        let status = response.status();
        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(Reply::RateLimited(retry_after(&response)));
        }
        if status.is_server_error() {
            return Err(Reply::Retryable);
        }
        if status.is_client_error() && status != StatusCode::NOT_FOUND {
            return Err(Reply::Done(Outcome::Failed));
        }
        Ok(response)
    }

    async fn sleep(&self, total: Duration) -> bool {
        let mut left = total;
        while !left.is_zero() {
            if self.cancel.load(Ordering::Relaxed) {
                return false;
            }
            let step = left.min(SLEEP_STEP);
            tokio::time::sleep(step).await;
            left -= step;
        }
        !self.cancel.load(Ordering::Relaxed)
    }
}

fn retry_after(response: &wreq::Response) -> Duration {
    let seconds = response
        .headers()
        .get("retry-after")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or(DEFAULT_RETRY_AFTER_SECS);
    Duration::from_secs(seconds.clamp(1, MAX_RETRY_AFTER_SECS))
}
