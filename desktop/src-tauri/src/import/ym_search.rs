use std::time::Duration;

use crate::network::audio_route;

const SEARCH_TIMEOUT: Duration = Duration::from_secs(20);
const COMBINED_LIMIT: usize = 3;
const TITLE_ONLY_LIMIT: usize = 20;

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

pub async fn find_track(
    client: &wreq::Client,
    backend_url: &str,
    session_id: &str,
    artist: &str,
    title: &str,
) -> Result<Option<String>, String> {
    let combined = search(
        client,
        backend_url,
        session_id,
        &format!("{artist} {title}"),
        COMBINED_LIMIT,
    )
    .await?;
    if let Some(first) = combined.into_iter().next() {
        return Ok(first.urn);
    }
    if artist.is_empty() || title.is_empty() {
        return Ok(None);
    }

    let by_title = search(client, backend_url, session_id, title, TITLE_ONLY_LIMIT).await?;
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
) -> Result<Vec<ScTrackResult>, String> {
    let url = format!(
        "{}/tracks?q={}&limit={}&linked_partitioning=true",
        backend_url,
        urlencoding::encode(query),
        limit
    );
    let session_id = Some(session_id).filter(|id| !id.is_empty());

    let (resp, _) =
        tokio::time::timeout(SEARCH_TIMEOUT, audio_route::get(client, &url, session_id))
            .await
            .map_err(|_| "search timed out".to_string())??;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }
    let result: ScSearchResult = resp.json().await.map_err(|e| e.to_string())?;
    Ok(result.collection)
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
    !artist.is_empty() && uploader.contains(&artist)
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
}
