use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::time::Duration;

use serde_json::Value;

use super::failure::{Failure, SOURCE_EMPTY, SOURCE_NOT_FOUND, YM_TOKEN_INVALID, YM_UNAVAILABLE};
use super::model::{Cancel, ExtList, ExtTrack, OnRead};
use super::ym_link::YmRef;

const API: &str = "https://api.music.yandex.net";
const TRACKS_PER_REQUEST: usize = 50;
const TRACKS_ATTEMPTS: u64 = 3;
const DIRECT_SHARE: usize = 9;

#[derive(serde::Serialize)]
pub struct YmPlaylistInfo {
    pub kind: String,
    pub title: String,
    pub track_count: usize,
}

#[derive(serde::Serialize)]
pub struct YmLibrary {
    pub owner: String,
    pub playlists: Vec<YmPlaylistInfo>,
}

pub struct Ym<'a> {
    pub client: &'a wreq::Client,
    pub token: Option<&'a str>,
    pub cancel: &'a Cancel,
}

pub fn clean_token(raw: &str) -> String {
    let raw = raw.trim();
    match raw.split_once("access_token=") {
        Some((_, rest)) => rest
            .split(['&', '#', ' '])
            .next()
            .unwrap_or(rest)
            .to_string(),
        None => raw.to_string(),
    }
}

fn text<'a>(value: &'a Value, pointer: &str) -> Option<&'a str> {
    value.pointer(pointer).and_then(Value::as_str)
}

fn id_of(value: &Value) -> Option<String> {
    let raw = match value {
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        _ => return None,
    };
    raw.split(':').next().map(str::to_string)
}

fn items<'a>(value: &'a Value, pointer: &str) -> &'a [Value] {
    value
        .pointer(pointer)
        .and_then(Value::as_array)
        .map_or(&[], Vec::as_slice)
}

fn to_track(track: &Value) -> Option<ExtTrack> {
    let title = text(track, "/title").unwrap_or("").trim();
    let version = text(track, "/version").unwrap_or("").trim();
    let artist = text(track, "/artists/0/name").unwrap_or("").trim();
    if title.is_empty() && artist.is_empty() {
        return None;
    }
    let title = if !version.is_empty() && !title.to_lowercase().contains(&version.to_lowercase()) {
        format!("{title} ({version})")
    } else {
        title.to_string()
    };
    Some(ExtTrack {
        artist: artist.to_string(),
        title,
        duration_ms: track.get("durationMs").and_then(Value::as_u64),
    })
}

fn liked_at(track: &Value) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    chrono::DateTime::parse_from_rfc3339(text(track, "/timestamp")?).ok()
}

fn newest_first(tracks: &[Value]) -> Vec<String> {
    let mut sorted: Vec<&Value> = tracks.iter().collect();
    if sorted.iter().all(|track| liked_at(track).is_some()) {
        sorted.sort_by_key(|track| std::cmp::Reverse(liked_at(track)));
    }
    sorted
        .into_iter()
        .filter_map(|track| id_of(&track["id"]))
        .collect()
}

impl Ym<'_> {
    async fn get(&self, path: &str) -> Result<Value, Failure> {
        let mut request = self
            .client
            .get(format!("{API}{path}"))
            .header("User-Agent", "Yandex-Music-API")
            .header("X-Yandex-Music-Client", "YandexMusicAndroid/24023621");
        if let Some(token) = self.token {
            request = request.header("Authorization", format!("OAuth {token}"));
        }
        let resp = request
            .send()
            .await
            .map_err(|e| Failure::new(YM_UNAVAILABLE, e.to_string()))?;
        let status = resp.status();
        let code = match status.as_u16() {
            401 | 403 => YM_TOKEN_INVALID,
            404 => SOURCE_NOT_FOUND,
            _ => YM_UNAVAILABLE,
        };
        if !status.is_success() {
            return Err(Failure::new(code, format!("HTTP {status}")));
        }
        resp.json()
            .await
            .map_err(|e| Failure::new(YM_UNAVAILABLE, e.to_string()))
    }

    async fn uid(&self) -> Result<i64, Failure> {
        let account = self.get("/account/status").await?;
        account
            .pointer("/result/account/uid")
            .and_then(Value::as_i64)
            .ok_or_else(|| Failure::new(YM_TOKEN_INVALID, "account status has no user id"))
    }

    pub async fn library(&self) -> Result<YmLibrary, Failure> {
        let uid = self.uid().await?;
        let lists = self.get(&format!("/users/{uid}/playlists/list")).await?;
        let playlists = items(&lists, "/result")
            .iter()
            .filter_map(|list| {
                Some(YmPlaylistInfo {
                    kind: id_of(&list["kind"])?,
                    title: text(list, "/title")?.to_string(),
                    track_count: list["trackCount"].as_u64().unwrap_or(0) as usize,
                })
            })
            .collect();
        Ok(YmLibrary {
            owner: uid.to_string(),
            playlists,
        })
    }

    pub async fn likes(&self, on_read: OnRead<'_>) -> Result<ExtList, Failure> {
        let uid = self.uid().await?;
        let likes = self.get(&format!("/users/{uid}/likes/tracks")).await?;
        let ids = newest_first(items(&likes, "/result/library/tracks"));
        let tracks = self.resolve(&ids, on_read).await?;
        Ok(ExtList {
            title: String::new(),
            tracks,
            partial: false,
        })
    }

    pub async fn fetch(&self, source: &YmRef, on_read: OnRead<'_>) -> Result<ExtList, Failure> {
        let list = match source {
            YmRef::UserPlaylist { owner, kind } => {
                let playlist = self
                    .get(&format!("/users/{owner}/playlists/{kind}"))
                    .await?;
                self.playlist_list(&playlist, on_read).await?
            }
            YmRef::Playlist { uuid } => {
                let playlist = self.get(&format!("/playlist/{uuid}")).await?;
                self.playlist_list(&playlist, on_read).await?
            }
            YmRef::Album { id } => {
                let album = self.get(&format!("/albums/{id}/with-tracks")).await?;
                let tracks = items(&album, "/result/volumes")
                    .iter()
                    .flat_map(|volume| volume.as_array().into_iter().flatten())
                    .filter_map(to_track)
                    .collect();
                ExtList {
                    title: text(&album, "/result/title").unwrap_or("").to_string(),
                    tracks,
                    partial: false,
                }
            }
            YmRef::Track { id } => {
                let found = self.get(&format!("/tracks/{id}")).await?;
                let tracks: Vec<ExtTrack> = items(&found, "/result")
                    .iter()
                    .filter_map(to_track)
                    .collect();
                ExtList {
                    title: tracks.first().map(ExtTrack::label).unwrap_or_default(),
                    tracks,
                    partial: false,
                }
            }
        };
        if list.tracks.is_empty() {
            return Err(Failure::new(SOURCE_EMPTY, "no tracks"));
        }
        Ok(list)
    }

    async fn playlist_list(
        &self,
        playlist: &Value,
        on_read: OnRead<'_>,
    ) -> Result<ExtList, Failure> {
        let entries = items(playlist, "/result/tracks");
        let direct: Vec<ExtTrack> = entries
            .iter()
            .filter_map(|entry| to_track(&entry["track"]))
            .collect();
        let tracks = if !direct.is_empty() && direct.len() >= entries.len() * DIRECT_SHARE / 10 {
            direct
        } else {
            let ids: Vec<String> = entries
                .iter()
                .filter_map(|entry| id_of(&entry["id"]).or_else(|| id_of(&entry["track"]["id"])))
                .collect();
            self.resolve(&ids, on_read).await?
        };
        Ok(ExtList {
            title: text(playlist, "/result/title").unwrap_or("").to_string(),
            tracks,
            partial: false,
        })
    }

    async fn resolve(&self, ids: &[String], on_read: OnRead<'_>) -> Result<Vec<ExtTrack>, Failure> {
        let mut found: HashMap<String, ExtTrack> = HashMap::new();
        for chunk in ids.chunks(TRACKS_PER_REQUEST) {
            if self.cancel.load(Ordering::Relaxed) {
                break;
            }
            let reply = self.tracks_with_retry(&chunk.join(",")).await?;
            for track in items(&reply, "/result") {
                if let (Some(id), Some(track)) = (id_of(&track["id"]), to_track(track)) {
                    found.insert(id, track);
                }
            }
            on_read(found.len(), ids.len());
        }
        Ok(ids.iter().filter_map(|id| found.remove(id)).collect())
    }

    async fn tracks_with_retry(&self, ids: &str) -> Result<Value, Failure> {
        let path = format!("/tracks?trackIds={ids}");
        let mut attempt = 0;
        loop {
            match self.get(&path).await {
                Err(failure) if failure.code == YM_TOKEN_INVALID => return Err(failure),
                Err(failure)
                    if attempt + 1 >= TRACKS_ATTEMPTS || self.cancel.load(Ordering::Relaxed) =>
                {
                    return Err(failure);
                }
                Err(_) => {
                    attempt += 1;
                    tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
                }
                Ok(reply) => return Ok(reply),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{clean_token, newest_first, to_track};

    #[test]
    fn orders_likes_from_newest_to_oldest() {
        let tracks = vec![
            json!({"id": 1, "timestamp": "2021-03-01T10:00:00+00:00"}),
            json!({"id": "3", "timestamp": "2024-01-05T09:00:00+03:00"}),
            json!({"id": 2, "timestamp": "2022-07-12T18:30:00+00:00"}),
        ];
        assert_eq!(newest_first(&tracks), vec!["3", "2", "1"]);
    }

    #[test]
    fn keeps_api_order_without_timestamps() {
        let tracks = vec![
            json!({"id": 5, "timestamp": "2021-03-01T10:00:00+00:00"}),
            json!({"id": 4}),
            json!({"id": "9:77", "timestamp": "2024-01-05T09:00:00+00:00"}),
        ];
        assert_eq!(newest_first(&tracks), vec!["5", "4", "9"]);
    }

    #[test]
    fn track_gets_version_and_first_artist() {
        let track = to_track(&json!({
            "title": "Gravity",
            "version": "Remix",
            "durationMs": 215000,
            "artists": [{"name": "Boris"}, {"name": "Other"}]
        }))
        .unwrap();
        assert_eq!(track.title, "Gravity (Remix)");
        assert_eq!(track.artist, "Boris");
        assert_eq!(track.duration_ms, Some(215000));
        assert!(to_track(&json!({"id": 1})).is_none());
    }

    #[test]
    fn token_is_taken_from_a_pasted_address() {
        assert_eq!(
            clean_token("https://music.yandex.ru/#access_token=y0_abc&token_type=bearer"),
            "y0_abc"
        );
        assert_eq!(clean_token("  y0_abc "), "y0_abc");
    }
}
