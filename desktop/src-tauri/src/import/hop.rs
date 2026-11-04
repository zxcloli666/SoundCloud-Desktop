use std::sync::atomic::Ordering;
use std::time::Duration;

use crate::network::edge;

use super::model::Cancel;

const HOP_TIMEOUT: Duration = Duration::from_secs(30);
const RETRY_PAUSE: Duration = Duration::from_secs(2);
const MAX_RETRY_PAUSE: Duration = Duration::from_secs(30);

pub struct HopError {
    pub status: Option<u16>,
    pub retry_after: Option<Duration>,
    pub reason: String,
}

impl HopError {
    pub fn transport(reason: impl Into<String>) -> Self {
        Self {
            status: None,
            retry_after: None,
            reason: reason.into(),
        }
    }

    fn http(resp: &wreq::Response) -> Self {
        let retry_after = resp
            .headers()
            .get(wreq::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<u64>().ok())
            .map(Duration::from_secs);
        Self {
            status: Some(resp.status().as_u16()),
            retry_after,
            reason: format!("HTTP {}", resp.status()),
        }
    }

    pub fn is_unauthorized(&self) -> bool {
        self.status == Some(401)
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self.status, Some(429 | 500..=599))
    }

    pub fn pause(&self, retry: u32) -> Duration {
        self.retry_after
            .unwrap_or(RETRY_PAUSE * retry)
            .min(MAX_RETRY_PAUSE)
    }
}

pub async fn post_json<B, R>(
    client: &wreq::Client,
    url: &str,
    session_id: &str,
    body: &B,
    cancel: &Cancel,
) -> Result<R, HopError>
where
    B: serde::Serialize + ?Sized,
    R: serde::de::DeserializeOwned,
{
    let mut last_error = HopError::transport("no route");
    for hop in edge::plan(url) {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let mut request = client.post(&hop.url).timeout(HOP_TIMEOUT).json(body);
        if !session_id.is_empty() {
            request = request.header("x-session-id", session_id);
        }
        let resp = match request.send().await {
            Ok(resp) => resp,
            Err(e) => {
                hop.note(false);
                last_error = HopError::transport(format!("{}: {e}", hop.tier_label()));
                continue;
            }
        };
        if !edge::hop_ok(&hop, &resp) {
            last_error = HopError::http(&resp);
            continue;
        }
        if !resp.status().is_success() {
            hop.note(true);
            return Err(HopError::http(&resp));
        }
        match resp.json::<R>().await {
            Err(e) if !e.is_decode() => {
                hop.note(false);
                last_error = HopError::transport(format!("{}: {e}", hop.tier_label()));
            }
            result => {
                hop.note(true);
                return result.map_err(|e| HopError::transport(e.to_string()));
            }
        }
    }
    Err(last_error)
}
