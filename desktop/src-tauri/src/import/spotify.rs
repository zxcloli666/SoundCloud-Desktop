use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::Value;

use super::failure::{Failure, SOURCE_EMPTY, SOURCE_NOT_FOUND, SOURCE_UNPARSED};
use super::model::{ExtList, ExtTrack};
use super::source::parse_url;

const EMBED_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
const EMBED_PLAYLIST_CAP: usize = 100;
const EMBED_ATTEMPTS: u32 = 3;
const EMBED_RETRY_PAUSE: Duration = Duration::from_millis(600);
const NBSP: char = '\u{a0}';

#[derive(Debug, PartialEq)]
pub struct SpotifyRef {
    pub kind: &'static str,
    pub id: String,
}

fn kind_of(word: &str) -> Option<&'static str> {
    ["playlist", "album", "track"]
        .into_iter()
        .find(|kind| *kind == word)
}

fn valid_id(id: &str) -> bool {
    (10..=40).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric())
}

pub fn parse(input: &str) -> Option<SpotifyRef> {
    let raw = input.trim();
    if let Some(rest) = raw.strip_prefix("spotify:") {
        let (kind, id) = rest.split_once(':')?;
        return Some(SpotifyRef {
            kind: kind_of(kind)?,
            id: id.to_string(),
        })
        .filter(|found| valid_id(&found.id));
    }
    let url = parse_url(raw)?;
    if !matches!(url.host_str()?, "open.spotify.com" | "play.spotify.com") {
        return None;
    }
    let mut parts = url
        .path_segments()?
        .filter(|part| !part.starts_with("intl-") && *part != "embed");
    let kind = kind_of(parts.next()?)?;
    let id = parts.next()?;
    valid_id(id).then(|| SpotifyRef {
        kind,
        id: id.to_string(),
    })
}

pub async fn fetch(client: &wreq::Client, source: &SpotifyRef) -> Result<ExtList, Failure> {
    let mut failure = Failure::new(SOURCE_UNPARSED, "no data in the embed page");
    for attempt in 0..EMBED_ATTEMPTS {
        if attempt > 0 {
            tokio::time::sleep(EMBED_RETRY_PAUSE).await;
        }
        match fetch_page(client, source).await {
            Err(error) if error.code == SOURCE_UNPARSED => failure = error,
            result => return result,
        }
    }
    Err(failure)
}

async fn fetch_page(client: &wreq::Client, source: &SpotifyRef) -> Result<ExtList, Failure> {
    let url = format!(
        "https://open.spotify.com/embed/{}/{}",
        source.kind, source.id
    );
    let resp = client
        .get(url)
        .header("User-Agent", EMBED_USER_AGENT)
        .header("Accept-Language", "en")
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
    let html = resp.text().await.map_err(Failure::unavailable)?;
    let entity = find_entity(&html)
        .ok_or_else(|| Failure::new(SOURCE_UNPARSED, "no data in the embed page"))?;
    let list = read_entity(&entity, source.kind);
    if list.tracks.is_empty() {
        return Err(Failure::new(SOURCE_EMPTY, "no tracks"));
    }
    Ok(list)
}

fn script_bodies(html: &str) -> Vec<&str> {
    let mut bodies = Vec::new();
    let mut rest = html;
    while let Some(open) = rest.find("<script") {
        let after = &rest[open..];
        let Some(start) = after.find('>') else { break };
        let Some(end) = after.find("</script>") else {
            break;
        };
        if end > start {
            bodies.push(after[start + 1..end].trim());
        }
        rest = &after[end + "</script>".len()..];
    }
    bodies
}

fn parse_script(body: &str) -> Option<Value> {
    serde_json::from_str(body).ok().or_else(|| {
        let decoded = STANDARD.decode(body).ok()?;
        serde_json::from_slice(&decoded).ok()
    })
}

fn find_key<'a>(value: &'a Value, key: &str, depth: usize) -> Option<&'a Value> {
    if depth > 14 {
        return None;
    }
    match value {
        Value::Object(map) if map.get(key).is_some_and(Value::is_array) => Some(value),
        Value::Object(map) => map
            .values()
            .find_map(|inner| find_key(inner, key, depth + 1)),
        Value::Array(list) => list
            .iter()
            .find_map(|inner| find_key(inner, key, depth + 1)),
        _ => None,
    }
}

fn find_entity(html: &str) -> Option<Value> {
    let roots: Vec<Value> = script_bodies(html)
        .into_iter()
        .filter_map(parse_script)
        .collect();
    let known = ["/props/pageProps/state/data/entity", "/data/entity"];
    for root in &roots {
        if let Some(entity) = known.iter().find_map(|pointer| root.pointer(pointer)) {
            return Some(entity.clone());
        }
    }
    roots
        .iter()
        .find_map(|root| find_key(root, "trackList", 0))
        .cloned()
}

fn artists_of(value: &Value) -> String {
    let named: Vec<&str> = value["artists"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|artist| artist["name"].as_str())
        .collect();
    let joined = if named.is_empty() {
        value["subtitle"].as_str().unwrap_or("").to_string()
    } else {
        named.join(", ")
    };
    joined.replace(NBSP, " ").trim().to_string()
}

fn title_of(value: &Value) -> Option<&str> {
    value["title"]
        .as_str()
        .or_else(|| value["name"].as_str())
        .map(str::trim)
        .filter(|title| !title.is_empty())
}

fn to_track(value: &Value) -> Option<ExtTrack> {
    Some(ExtTrack {
        artist: artists_of(value),
        title: title_of(value)?.to_string(),
        duration_ms: value["duration"].as_u64().filter(|ms| *ms > 0),
    })
}

fn read_entity(entity: &Value, kind: &str) -> ExtList {
    let title = title_of(entity).unwrap_or("").to_string();
    let listed = entity["trackList"].as_array();
    let tracks: Vec<ExtTrack> = match listed {
        Some(list) if !list.is_empty() => list.iter().filter_map(to_track).collect(),
        _ => to_track(entity).into_iter().collect(),
    };
    let partial = kind == "playlist" && tracks.len() >= EMBED_PLAYLIST_CAP;
    ExtList {
        title,
        tracks,
        partial,
    }
}

#[cfg(test)]
mod tests {
    use super::{find_entity, parse, read_entity};

    #[test]
    fn parses_links_and_uris() {
        let id = "37i9dQZF1DXcBWIGoYBM5M";
        for input in [
            format!("https://open.spotify.com/playlist/{id}?si=abc"),
            format!("open.spotify.com/intl-ru/playlist/{id}"),
            format!("https://open.spotify.com/embed/playlist/{id}"),
            format!("spotify:playlist:{id}"),
        ] {
            let found = parse(&input).unwrap();
            assert_eq!((found.kind, found.id.as_str()), ("playlist", id), "{input}");
        }
        assert!(parse("https://open.spotify.com/user/abc").is_none());
        assert!(parse("https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M").is_none());
    }

    #[test]
    fn reads_the_embed_page_data() {
        let html = r#"<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"state":{"data":{"entity":{"name":"Mix","trackList":[{"title":"Gravity","subtitle":"Boris Brejcha","duration":215000},{"title":"Numb","subtitle":"Linkin Park","duration":185000}]}}}}}}</script></html>"#;
        let list = read_entity(&find_entity(html).unwrap(), "playlist");
        assert_eq!(list.title, "Mix");
        assert_eq!(list.tracks.len(), 2);
        assert_eq!(list.tracks[0].artist, "Boris Brejcha");
        assert_eq!(list.tracks[0].duration_ms, Some(215000));
        assert!(!list.partial);
    }
}
