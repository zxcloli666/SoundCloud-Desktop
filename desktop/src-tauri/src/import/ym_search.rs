use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::network::edge::{self, Hop, Tier};

const HOP_TIMEOUT: Duration = Duration::from_secs(15);
const SEARCH_RETRIES: u32 = 2;
const RETRY_PAUSE: Duration = Duration::from_secs(2);
const MAX_RETRY_PAUSE: Duration = Duration::from_secs(15);
const COMBINED_LIMIT: usize = 3;
const TITLE_ONLY_LIMIT: usize = 20;
const MIN_PARTIAL_ARTIST_LEN: usize = 3;

#[derive(serde::Deserialize)]
struct ScSearchResult {
    collection: Vec<ScTrackResult>,
}

#[derive(serde::Deserialize)]
struct ScTrackResult {
    urn: Option<String>,
    user: Option<ScUser>,
}

#[derive(serde::Deserialize)]
struct ScUser {
    username: Option<String>,
}

pub struct SearchError {
    pub status: Option<u16>,
    pub retry_after: Option<Duration>,
    pub reason: String,
}

impl SearchError {
    fn transport(reason: impl Into<String>) -> Self {
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

    fn is_retryable(&self) -> bool {
        matches!(self.status, Some(429 | 500..=599))
    }

    fn pause(&self, retry: u32) -> Duration {
        self.retry_after
            .unwrap_or(RETRY_PAUSE * retry)
            .min(MAX_RETRY_PAUSE)
    }
}

pub async fn find_track(
    client: &wreq::Client,
    backend_url: &str,
    session_id: &str,
    artist: &str,
    title: &str,
    cancel: &AtomicBool,
) -> Result<Option<String>, SearchError> {
    let combined = search(
        client,
        backend_url,
        session_id,
        &format!("{artist} {title}"),
        COMBINED_LIMIT,
        cancel,
    )
    .await?;
    if let Some(first) = combined.into_iter().next() {
        return Ok(first.urn);
    }
    if artist.is_empty() || title.is_empty() || cancel.load(Ordering::Relaxed) {
        return Ok(None);
    }

    let by_title = search(
        client,
        backend_url,
        session_id,
        title,
        TITLE_ONLY_LIMIT,
        cancel,
    )
    .await?;
    Ok(by_title
        .into_iter()
        .find(|track| uploaded_by(track, artist))
        .and_then(|track| track.urn))
}

async fn search(
    client: &wreq::Client,
    backend_url: &str,
    session_id: &str,
    query: &str,
    limit: usize,
    cancel: &AtomicBool,
) -> Result<Vec<ScTrackResult>, SearchError> {
    let url = format!(
        "{}/tracks?q={}&limit={}&linked_partitioning=true",
        backend_url,
        urlencoding::encode(query),
        limit
    );

    let mut retries = 0;
    loop {
        match search_once(client, &url, session_id, cancel).await {
            Err(_) if cancel.load(Ordering::Relaxed) => return Ok(Vec::new()),
            Err(error) if error.is_retryable() && retries < SEARCH_RETRIES => {
                retries += 1;
                tokio::time::sleep(error.pause(retries)).await;
            }
            result => return result,
        }
    }
}

async fn search_once(
    client: &wreq::Client,
    url: &str,
    session_id: &str,
    cancel: &AtomicBool,
) -> Result<Vec<ScTrackResult>, SearchError> {
    let mut hops = edge::plan(url);
    if hops.is_empty() {
        hops.push(Hop {
            url: url.to_string(),
            tier: Tier::Direct,
            origin: String::new(),
        });
    }

    let mut last_error = SearchError::transport("no route");
    for hop in hops {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let mut request = client.get(&hop.url).timeout(HOP_TIMEOUT);
        if !session_id.is_empty() {
            request = request.header("x-session-id", session_id);
        }
        let resp = match request.send().await {
            Ok(resp) => resp,
            Err(e) => {
                hop.note(false);
                last_error = SearchError::transport(format!("{}: {e}", hop.tier_label()));
                continue;
            }
        };
        if !edge::hop_ok(&hop, &resp) {
            last_error = SearchError::http(&resp);
            continue;
        }
        if !resp.status().is_success() {
            hop.note(true);
            return Err(SearchError::http(&resp));
        }
        match resp.json::<ScSearchResult>().await {
            Err(e) if !e.is_decode() => {
                hop.note(false);
                last_error = SearchError::transport(format!("{}: {e}", hop.tier_label()));
            }
            result => {
                hop.note(true);
                return result
                    .map(|found| found.collection)
                    .map_err(|e| SearchError::transport(e.to_string()));
            }
        }
    }
    Err(last_error)
}

fn simplify(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn uploaded_by(track: &ScTrackResult, artist: &str) -> bool {
    let artist = simplify(artist);
    let uploader = track
        .user
        .as_ref()
        .and_then(|user| user.username.as_deref())
        .map(simplify)
        .unwrap_or_default();
    !artist.is_empty()
        && (uploader == artist
            || (artist.chars().count() >= MIN_PARTIAL_ARTIST_LEN && uploader.contains(&artist)))
}

#[cfg(test)]
mod tests {
    use super::{ScTrackResult, ScUser, uploaded_by};

    fn track_by(username: &str) -> ScTrackResult {
        ScTrackResult {
            urn: Some("soundcloud:tracks:1".into()),
            user: Some(ScUser {
                username: Some(username.into()),
            }),
        }
    }

    #[test]
    fn official_channel_counts_as_the_artist() {
        assert!(uploaded_by(
            &track_by("Boris Brejcha - Official"),
            "boris brejcha"
        ));
        assert!(uploaded_by(&track_by("Скриптонит"), "Скриптонит"));
    }

    #[test]
    fn other_uploaders_and_empty_names_do_not_match() {
        assert!(!uploaded_by(
            &track_by("some random reposter"),
            "Boris Brejcha"
        ));
        assert!(!uploaded_by(&track_by("anyone"), "!!!"));
        assert!(!uploaded_by(
            &ScTrackResult {
                urn: None,
                user: None
            },
            "Boris Brejcha"
        ));
    }

    #[test]
    fn short_artist_names_need_an_exact_uploader() {
        assert!(uploaded_by(&track_by("MØ"), "mø"));
        assert!(uploaded_by(&track_by("U2"), "U2"));
        assert!(!uploaded_by(&track_by("Mumford & Sons"), "M"));
        assert!(!uploaded_by(&track_by("U2 Tribute Band"), "U2"));
        assert!(!uploaded_by(&track_by("Kamø"), "MØ"));
    }
}
