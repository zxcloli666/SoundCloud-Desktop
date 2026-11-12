use serde::{Deserialize, Serialize};
use serde_json::Value;
use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;

const POPULARITY_SCALE: f64 = 18.0;

#[derive(Serialize)]
pub struct Request {
    pub variants: Vec<String>,
    pub kinds: Vec<&'static str>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub known: bool,
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
    let main = variants.iter().filter(|v| !v.fallback);
    let extras = main
        .clone()
        .flat_map(|v| [v.artist.clone(), v.title.clone()])
        .flatten();
    let fallbacks = variants
        .iter()
        .filter(|v| v.fallback)
        .map(|v| v.text.clone());
    for text in main.map(|v| v.text.clone()).chain(extras).chain(fallbacks) {
        let text = text.trim().to_string();
        if !text.is_empty() && !texts.contains(&text) {
            texts.push(text);
        }
    }
    let first = texts.first();
    let known = variants
        .iter()
        .filter(|v| !v.fallback && v.alias_kind.is_some())
        .any(|v| first.is_some_and(|first| first == v.text.trim()));
    Request {
        variants: texts,
        kinds: kinds.iter().map(|k| k.name()).collect(),
        known,
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
    fn the_request_lists_texts_then_artist_and_title_then_fallbacks() {
        let variant =
            |text: &str, artist: Option<&str>, title: Option<&str>, fallback: bool| Variant {
                text: text.into(),
                artist: artist.map(Into::into),
                title: title.map(Into::into),
                kept_fillers: false,
                lemmatized: false,
                fallback,
                alias_kind: None,
            };
        let variants = vec![
            variant("песню", None, None, true),
            variant("земфира хочу", Some("земфира"), Some("хочу"), false),
            variant("земфира хочу", None, None, false),
            variant("хочу", None, None, true),
        ];
        let request = request(&variants, &Kind::ALL);
        assert_eq!(
            request.variants,
            vec!["земфира хочу", "земфира", "хочу", "песню"]
        );
        assert_eq!(request.kinds, vec!["artist", "track", "album", "playlist"]);
        assert!(!request.known);
    }

    fn said(text: &str, alias_kind: Option<Kind>) -> Variant {
        Variant {
            text: text.into(),
            artist: None,
            title: None,
            kept_fillers: false,
            lemmatized: false,
            fallback: false,
            alias_kind,
        }
    }

    #[test]
    fn a_curated_name_asked_first_is_sent_as_known() {
        let variants = vec![
            said("Bruce Springsteen", Some(Kind::Artist)),
            said("брюс спрингстин", None),
        ];
        let request = request(&variants, &Kind::ALL);
        assert_eq!(request.variants[0], "Bruce Springsteen");
        assert!(request.known);
        let body = serde_json::to_value(&request).unwrap();
        assert_eq!(body["known"], true);
    }

    #[test]
    fn a_curated_name_asked_after_what_was_said_is_not_sent_as_known() {
        let variants = vec![
            said("намб линкин парк", None),
            said("намб Linkin Park", Some(Kind::Artist)),
        ];
        let request = request(&variants, &Kind::ALL);
        assert!(!request.known);
        let body = serde_json::to_value(&request).unwrap();
        assert!(body.get("known").is_none());
    }
}
