use std::collections::HashSet;

use serde_json::{Value, json};

use super::failure::{Failure, SOURCE_EMPTY, SOURCE_NOT_FOUND};
use super::model::{ExtList, ExtTrack, OnRead};
use super::source::parse_url;
use super::youtube_title::to_track;

const API: &str = "https://www.youtube.com/youtubei/v1";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const CLIENT_VERSION: &str = "2.20260708.00.00";
const TRACK_LIMIT: usize = 2000;
const MAX_PAGES: usize = 120;

#[derive(Debug, PartialEq)]
pub enum YtRef {
    Video(String),
    Playlist(String),
}

struct Entry {
    id: String,
    title: String,
    channel: String,
    duration_ms: Option<u64>,
}

fn is_video_id(raw: &str) -> bool {
    raw.len() == 11
        && raw
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

fn is_list_id(raw: &str) -> bool {
    raw.len() >= 10
        && !raw.starts_with("RD")
        && raw
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

pub fn parse(input: &str) -> Option<YtRef> {
    let raw = input.trim();
    let url = parse_url(raw)?;
    let host = url.host_str()?.to_ascii_lowercase();
    let host = host.trim_start_matches("www.").trim_start_matches("m.");
    if !matches!(
        host,
        "youtube.com" | "music.youtube.com" | "youtu.be" | "youtube-nocookie.com"
    ) {
        return None;
    }
    let query = |key: &str| {
        url.query_pairs()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.into_owned())
    };
    let path = url.path().trim_matches('/');
    let list = query("list").filter(|list| is_list_id(list));
    let video = if host == "youtu.be" {
        path.split('/').next().map(str::to_string)
    } else if let Some(rest) = ["shorts/", "embed/", "live/"]
        .iter()
        .find_map(|prefix| path.strip_prefix(prefix))
    {
        rest.split('/').next().map(str::to_string)
    } else {
        query("v")
    }
    .filter(|id| is_video_id(id));

    let browsed = path.strip_prefix("browse/VL").map(str::to_string);
    match (list, video, browsed) {
        (_, _, Some(id)) => Some(YtRef::Playlist(id)),
        (Some(list), _, _) if path == "playlist" || list.starts_with("OLAK") => {
            Some(YtRef::Playlist(list))
        }
        (_, Some(video), _) => Some(YtRef::Video(video)),
        (Some(list), None, _) => Some(YtRef::Playlist(list)),
        _ => None,
    }
}

pub async fn fetch(
    client: &wreq::Client,
    source: &YtRef,
    on_read: OnRead<'_>,
) -> Result<ExtList, Failure> {
    match source {
        YtRef::Video(id) => video(client, id).await,
        YtRef::Playlist(id) => playlist(client, id, on_read).await,
    }
}

async fn video(client: &wreq::Client, id: &str) -> Result<ExtList, Failure> {
    let watch = format!("https://www.youtube.com/watch?v={id}");
    let url = format!(
        "https://www.youtube.com/oembed?format=json&url={}",
        urlencoding::encode(&watch)
    );
    let resp = client
        .get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(Failure::unavailable)?;
    let status = resp.status();
    if matches!(status.as_u16(), 400 | 401 | 403 | 404) {
        return Err(Failure::new(SOURCE_NOT_FOUND, format!("HTTP {status}")));
    }
    if !status.is_success() {
        return Err(Failure::unavailable(format!("HTTP {status}")));
    }
    let info: Value = resp.json().await.map_err(Failure::unavailable)?;
    let title = info["title"].as_str().unwrap_or("");
    let channel = info["author_name"].as_str().unwrap_or("");
    let track = to_track(title, channel, None);
    Ok(ExtList {
        title: track.label(),
        tracks: vec![track],
        partial: false,
    })
}

async fn call(client: &wreq::Client, endpoint: &str, body: Value) -> Result<Value, Failure> {
    let mut payload = json!({
        "context": {"client": {
            "clientName": "WEB",
            "clientVersion": CLIENT_VERSION,
            "hl": "en",
            "gl": "US",
        }}
    });
    payload
        .as_object_mut()
        .into_iter()
        .for_each(|map| map.extend(body.as_object().cloned().unwrap_or_default()));
    let resp = client
        .post(format!("{API}/{endpoint}?prettyPrint=false"))
        .header("User-Agent", USER_AGENT)
        .header("Origin", "https://www.youtube.com")
        .header("X-YouTube-Client-Name", "1")
        .header("X-YouTube-Client-Version", CLIENT_VERSION)
        .json(&payload)
        .send()
        .await
        .map_err(Failure::unavailable)?;
    let status = resp.status();
    if status.as_u16() == 404 {
        return Err(Failure::new(SOURCE_NOT_FOUND, "HTTP 404"));
    }
    if !status.is_success() {
        return Err(Failure::unavailable(format!("HTTP {status}")));
    }
    resp.json().await.map_err(Failure::unavailable)
}

fn runs_text(value: &Value) -> Option<String> {
    if let Some(text) = value["simpleText"]
        .as_str()
        .or_else(|| value["content"].as_str())
    {
        return Some(text.to_string());
    }
    let joined: String = value["runs"]
        .as_array()?
        .iter()
        .filter_map(|run| run["text"].as_str())
        .collect();
    (!joined.is_empty()).then_some(joined)
}

fn clock_ms(text: &str) -> Option<u64> {
    text.split(':')
        .map(|part| part.trim().parse::<u64>().ok())
        .try_fold(0u64, |acc, part| Some(acc * 60 + part?))
        .map(|secs| secs * 1000)
}

fn entry_of(renderer: &Value, panel: bool) -> Option<Entry> {
    let id = renderer["videoId"].as_str()?.to_string();
    if renderer["isPlayable"].as_str() == Some("false") {
        return None;
    }
    let (channel, duration_ms) = if panel {
        let channel = runs_text(&renderer["longBylineText"])
            .or_else(|| runs_text(&renderer["shortBylineText"]));
        (
            channel,
            runs_text(&renderer["lengthText"]).and_then(|text| clock_ms(&text)),
        )
    } else {
        let secs = renderer["lengthSeconds"]
            .as_str()
            .and_then(|s| s.parse::<u64>().ok());
        (
            runs_text(&renderer["shortBylineText"]),
            secs.map(|s| s * 1000),
        )
    };
    Some(Entry {
        id,
        title: runs_text(&renderer["title"]).unwrap_or_default(),
        channel: channel.unwrap_or_default(),
        duration_ms: duration_ms.filter(|ms| *ms > 0),
    })
}

fn collect(
    value: &Value,
    entries: &mut Vec<Entry>,
    seen: &mut HashSet<String>,
    tokens: &mut Vec<String>,
) {
    match value {
        Value::Object(map) => {
            for (key, inner) in map {
                let panel = key == "playlistPanelVideoRenderer";
                if panel || key == "playlistVideoRenderer" {
                    if let Some(entry) =
                        entry_of(inner, panel).filter(|e| seen.insert(e.id.clone()))
                    {
                        entries.push(entry);
                    }
                    continue;
                }
                if key == "continuationCommand"
                    && let Some(token) = inner["token"].as_str()
                {
                    tokens.push(token.to_string());
                }
                collect(inner, entries, seen, tokens);
            }
        }
        Value::Array(list) => list
            .iter()
            .for_each(|inner| collect(inner, entries, seen, tokens)),
        _ => {}
    }
}

fn playlist_title(page: &Value) -> Option<String> {
    page.pointer("/metadata/playlistMetadataRenderer/title")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| runs_text(page.pointer("/header/playlistHeaderRenderer/title")?))
        .or_else(|| {
            page.pointer("/header/pageHeaderRenderer/pageTitle")?
                .as_str()
                .map(str::to_string)
        })
}

async fn playlist(
    client: &wreq::Client,
    id: &str,
    on_read: OnRead<'_>,
) -> Result<ExtList, Failure> {
    let mut entries = Vec::new();
    let mut seen = HashSet::new();
    let mut tokens = Vec::new();
    let first = call(client, "browse", json!({"browseId": format!("VL{id}")})).await?;
    let title = playlist_title(&first);
    collect(&first, &mut entries, &mut seen, &mut tokens);
    on_read(entries.len(), 0);

    for _ in 0..MAX_PAGES {
        let Some(token) = tokens.pop().filter(|_| entries.len() < TRACK_LIMIT) else {
            break;
        };
        tokens.clear();
        let before = entries.len();
        let page = call(client, "browse", json!({"continuation": token})).await?;
        collect(&page, &mut entries, &mut seen, &mut tokens);
        on_read(entries.len(), 0);
        if entries.len() == before {
            break;
        }
    }

    if entries.is_empty() {
        let next = call(client, "next", json!({"playlistId": id})).await?;
        collect(&next, &mut entries, &mut seen, &mut Vec::new());
    }
    if entries.is_empty() {
        return Err(Failure::new(SOURCE_EMPTY, "playlist is empty or private"));
    }
    entries.truncate(TRACK_LIMIT);
    let tracks: Vec<ExtTrack> = entries
        .iter()
        .map(|entry| to_track(&entry.title, &entry.channel, entry.duration_ms))
        .collect();
    Ok(ExtList {
        title: title.unwrap_or_default(),
        tracks,
        partial: false,
    })
}

#[cfg(test)]
mod tests {
    use super::{YtRef, clock_ms, parse};

    #[test]
    fn reads_video_and_playlist_links() {
        let list = "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf";
        assert_eq!(
            parse(&format!("https://www.youtube.com/playlist?list={list}")),
            Some(YtRef::Playlist(list.into()))
        );
        assert_eq!(
            parse(&format!("https://music.youtube.com/playlist?list={list}")),
            Some(YtRef::Playlist(list.into()))
        );
        assert_eq!(
            parse("https://youtu.be/dQw4w9WgXcQ?si=x"),
            Some(YtRef::Video("dQw4w9WgXcQ".into()))
        );
        assert_eq!(
            parse(&format!(
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list={list}"
            )),
            Some(YtRef::Video("dQw4w9WgXcQ".into()))
        );
        assert_eq!(
            parse("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ"),
            Some(YtRef::Video("dQw4w9WgXcQ".into()))
        );
        assert_eq!(parse("https://www.youtube.com/"), None);
        assert_eq!(parse("dQw4w9WgXcQ"), None);
    }

    #[test]
    fn clock_text_becomes_milliseconds() {
        assert_eq!(clock_ms("3:35"), Some(215_000));
        assert_eq!(clock_ms("1:02:03"), Some(3_723_000));
        assert_eq!(clock_ms("live"), None);
    }
}
