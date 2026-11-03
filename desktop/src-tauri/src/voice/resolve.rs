use serde::{Deserialize, Serialize};
use serde_json::Value;
use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;

const POPULARITY_SCALE: f64 = 18.0;

#[derive(Serialize)]
pub struct Request {
    pub variants: Vec<String>,
    pub kinds: Vec<&'static str>,
}

#[derive(Deserialize)]
struct Hit {
    id: String,
    kind: String,
    name: String,
    #[serde(default)]
    artist: String,
    #[serde(default)]
    popularity: f64,
    #[serde(default)]
    artist_aliases: Vec<String>,
}

pub fn request(variants: &[Variant], kinds: &[Kind]) -> Request {
    let mut texts: Vec<String> = Vec::new();
    let extras = variants
        .iter()
        .flat_map(|v| [v.artist.clone(), v.title.clone()])
        .flatten();
    for text in variants.iter().map(|v| v.text.clone()).chain(extras) {
        let text = text.trim().to_string();
        if !text.is_empty() && !texts.contains(&text) {
            texts.push(text);
        }
    }
    Request {
        variants: texts,
        kinds: kinds.iter().map(|k| k.name()).collect(),
    }
}

pub fn entities(body: &Value) -> Vec<Entity> {
    let results = body.get("results").unwrap_or(body);
    let Some(groups) = results.as_object() else {
        return Vec::new();
    };
    groups
        .values()
        .filter_map(Value::as_array)
        .flatten()
        .filter_map(|hit| serde_json::from_value::<Hit>(hit.clone()).ok())
        .filter_map(entity)
        .collect()
}

fn entity(hit: Hit) -> Option<Entity> {
    let kind = Kind::from_name(&hit.kind)?;
    let artist = Some(hit.artist).filter(|a| !a.trim().is_empty());
    Some(Entity {
        kind,
        name: hit.name,
        artist,
        popularity: listeners(hit.popularity),
        id: hit.id,
        aliases: Vec::new(),
        artist_aliases: hit.artist_aliases,
    })
}

fn listeners(popularity: f64) -> u64 {
    if popularity <= 1.0 {
        ((popularity.max(0.0) * POPULARITY_SCALE).exp() - 1.0) as u64
    } else {
        popularity as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_backend_reply_becomes_entities() {
        let body = serde_json::json!({
            "results": {
                "artist": [{"id": "a1", "kind": "artist", "name": "Скриптонит", "artist": "", "popularity": 0.87, "score": 1.4, "variant": 0}],
                "track": [{"id": "t1", "kind": "track", "name": "Цепи", "artist": "Скриптонит", "popularity": 0.8, "score": 0.9, "variant": 1, "artist_aliases": ["scriptonite"]}],
                "album": []
            }
        });
        let found = entities(&body);
        assert_eq!(found.len(), 2);
        let artist = found.iter().find(|e| e.kind == Kind::Artist).unwrap();
        assert_eq!(artist.artist, None);
        assert!(
            (5_000_000..7_000_000).contains(&artist.popularity),
            "{}",
            artist.popularity
        );
        let track = found.iter().find(|e| e.kind == Kind::Track).unwrap();
        assert_eq!(track.artist.as_deref(), Some("Скриптонит"));
        assert_eq!(track.artist_aliases, vec!["scriptonite".to_string()]);
    }

    #[test]
    fn unknown_kinds_and_broken_rows_are_skipped() {
        let body = serde_json::json!({"results": {"user": [{"id": "u", "kind": "user", "name": "x"}], "track": [{"name": "no id"}]}});
        assert!(entities(&body).is_empty());
    }

    #[test]
    fn the_request_lists_texts_then_artist_and_title_once() {
        let variants = vec![
            Variant {
                text: "земфира хочу".into(),
                artist: Some("земфира".into()),
                title: Some("хочу".into()),
                kept_fillers: false,
                lemmatized: false,
            },
            Variant {
                text: "земфира хочу".into(),
                artist: None,
                title: None,
                kept_fillers: true,
                lemmatized: false,
            },
        ];
        let request = request(&variants, &Kind::ALL);
        assert_eq!(request.variants, vec!["земфира хочу", "земфира", "хочу"]);
        assert_eq!(request.kinds, vec!["artist", "track", "album", "playlist"]);
    }
}
