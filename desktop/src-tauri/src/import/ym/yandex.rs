use serde::Deserialize;
use serde_json::Value;

const API: &str = "https://api.music.yandex.net";

pub struct YmTrack {
    pub title: String,
    pub artists: Vec<String>,
    pub duration_ms: Option<u64>,
}

impl YmTrack {
    pub fn primary_artist(&self) -> &str {
        self.artists.first().map(String::as_str).unwrap_or("")
    }

    pub fn label(&self) -> String {
        format!("{} - {}", self.artists.join(", "), self.title)
    }

    pub fn is_blank(&self) -> bool {
        self.title.is_empty() && self.artists.is_empty()
    }
}

#[derive(Deserialize)]
struct LikesResponse {
    result: LikesResult,
}

#[derive(Deserialize)]
struct LikesResult {
    library: Library,
}

#[derive(Deserialize)]
struct Library {
    tracks: Vec<LikedTrack>,
}

#[derive(Deserialize)]
struct LikedTrack {
    id: Value,
}

#[derive(Deserialize)]
struct TracksResponse {
    result: Vec<RawTrack>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTrack {
    title: Option<String>,
    version: Option<String>,
    artists: Option<Vec<RawArtist>>,
    duration_ms: Option<u64>,
}

#[derive(Deserialize)]
struct RawArtist {
    name: Option<String>,
}

impl From<RawTrack> for YmTrack {
    fn from(raw: RawTrack) -> Self {
        let title = raw.title.unwrap_or_default().trim().to_owned();
        let title = match raw.version.as_deref().map(str::trim) {
            Some(version) if !version.is_empty() && !title.is_empty() => {
                format!("{title} ({version})")
            }
            _ => title,
        };
        let artists = raw
            .artists
            .unwrap_or_default()
            .into_iter()
            .filter_map(|artist| artist.name)
            .map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty())
            .collect();
        Self {
            title,
            artists,
            duration_ms: raw.duration_ms.filter(|ms| *ms > 0),
        }
    }
}

pub struct Yandex {
    client: wreq::Client,
    auth: String,
}

impl Yandex {
    pub fn new(client: wreq::Client, token: &str) -> Self {
        Self {
            client,
            auth: format!("OAuth {token}"),
        }
    }

    async fn get(&self, path: &str) -> Result<wreq::Response, String> {
        self.client
            .get(format!("{API}{path}"))
            .header("Authorization", &self.auth)
            .send()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn liked_track_ids(&self) -> Result<Vec<String>, String> {
        let status = self
            .get("/account/status")
            .await
            .map_err(|e| format!("YM auth failed: {e}"))?;
        if !status.status().is_success() {
            return Err(format!("YM auth failed: HTTP {}", status.status()));
        }
        let status: Value = status.json().await.map_err(|e| e.to_string())?;
        let uid = status["result"]["account"]["uid"]
            .as_i64()
            .ok_or("Failed to get YM user ID")?;

        let likes: LikesResponse = self
            .get(&format!("/users/{uid}/likes/tracks"))
            .await
            .map_err(|e| format!("Failed to fetch YM likes: {e}"))?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        Ok(likes
            .result
            .library
            .tracks
            .into_iter()
            .map(|track| match track.id {
                Value::Number(n) => n.to_string(),
                Value::String(s) => s,
                other => other.to_string(),
            })
            .collect())
    }

    pub async fn tracks(&self, ids: &[String]) -> Option<Vec<YmTrack>> {
        let response = self
            .get(&format!("/tracks?trackIds={}", ids.join(",")))
            .await
            .ok()?;
        let tracks: TracksResponse = response.json().await.ok()?;
        Some(tracks.result.into_iter().map(YmTrack::from).collect())
    }
}
