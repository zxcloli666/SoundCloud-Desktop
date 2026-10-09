use serde_json::{Value, json};

use super::error::ApiError;
use super::store::{Profile, Scrobble};

const API: &str = "https://api.listenbrainz.org/1";
const SITE: &str = "https://listenbrainz.org/user";
const CLIENT: &str = "SoundCloud Desktop";
pub const BATCH: usize = 50;

#[derive(Clone, Copy)]
pub enum ListenType {
    PlayingNow,
    Single,
    Import,
}

impl ListenType {
    fn as_str(self) -> &'static str {
        match self {
            Self::PlayingNow => "playing_now",
            Self::Single => "single",
            Self::Import => "import",
        }
    }

    pub fn for_batch(len: usize) -> Self {
        if len > 1 { Self::Import } else { Self::Single }
    }
}

fn authorization(token: &str) -> String {
    format!("Token {}", token.trim())
}

async fn read(response: wreq::Response) -> Result<Value, ApiError> {
    let status = response.status().as_u16();
    let text = response.text().await.map_err(ApiError::network)?;
    if status >= 400 {
        return Err(ApiError::from_status(status, &text));
    }
    Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
}

pub async fn validate(http: &wreq::Client, token: &str) -> Result<String, ApiError> {
    let response = http
        .get(format!("{API}/validate-token"))
        .header("authorization", authorization(token))
        .send()
        .await
        .map_err(ApiError::network)?;
    let value = read(response).await?;
    if value.get("valid").and_then(Value::as_bool) != Some(true) {
        return Err(ApiError::Session);
    }
    value
        .get("user_name")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or(ApiError::Session)
}

pub async fn profile(http: &wreq::Client, name: &str) -> Result<Profile, ApiError> {
    let encoded = urlencoding::encode(name);
    let response = http
        .get(format!("{API}/user/{encoded}/listen-count"))
        .send()
        .await
        .map_err(ApiError::network)?;
    let value = read(response).await?;
    Ok(Profile {
        name: name.to_owned(),
        url: Some(format!("{SITE}/{encoded}/")),
        image: None,
        playcount: value
            .get("payload")
            .and_then(|p| p.get("count"))
            .and_then(Value::as_u64),
        since: None,
    })
}

fn listen(track: &Scrobble, kind: ListenType) -> Value {
    let mut info = json!({
        "media_player": CLIENT,
        "submission_client": CLIENT,
        "submission_client_version": env!("CARGO_PKG_VERSION"),
        "music_service": "soundcloud.com",
        "music_service_name": "SoundCloud",
    });
    if let Some(duration) = track.duration_secs {
        info["duration_ms"] = json!(u64::from(duration) * 1000);
    }
    if let Some(url) = &track.url {
        info["origin_url"] = json!(url);
    }
    let mut listen = json!({
        "track_metadata": {
            "artist_name": track.artist,
            "track_name": track.title,
            "additional_info": info,
        }
    });
    if !matches!(kind, ListenType::PlayingNow) {
        listen["listened_at"] = json!(track.timestamp);
    }
    listen
}

pub fn payload(tracks: &[Scrobble], kind: ListenType) -> Value {
    json!({
        "listen_type": kind.as_str(),
        "payload": tracks.iter().map(|t| listen(t, kind)).collect::<Vec<_>>(),
    })
}

pub async fn submit(
    http: &wreq::Client,
    token: &str,
    tracks: &[Scrobble],
    kind: ListenType,
) -> Result<(), ApiError> {
    let body = payload(tracks, kind).to_string();
    let response = http
        .post(format!("{API}/submit-listens"))
        .header("authorization", authorization(token))
        .header("content-type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(ApiError::network)?;
    read(response).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track() -> Scrobble {
        Scrobble {
            artist: "Artist".into(),
            title: "Song".into(),
            timestamp: 1_700_000_000,
            duration_secs: Some(200),
            url: Some("https://soundcloud.com/a/song".into()),
        }
    }

    #[test]
    fn playing_now_has_no_timestamp() {
        let body = payload(&[track()], ListenType::PlayingNow);
        assert_eq!(body["listen_type"], "playing_now");
        assert!(body["payload"][0].get("listened_at").is_none());
    }

    #[test]
    fn listens_carry_timestamp_and_metadata() {
        let body = payload(&[track(), track()], ListenType::for_batch(2));
        assert_eq!(body["listen_type"], "import");
        let first = &body["payload"][0];
        assert_eq!(first["listened_at"], 1_700_000_000);
        assert_eq!(first["track_metadata"]["artist_name"], "Artist");
        assert_eq!(
            first["track_metadata"]["additional_info"]["duration_ms"],
            200_000
        );
    }
}
