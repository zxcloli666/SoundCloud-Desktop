use serde::{Deserialize, Serialize};
use serde_json::Value;
use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, Lookup};

const POPULARITY_SCALE: f64 = 18.0;

#[derive(Serialize)]
pub struct Request {
    pub variants: Vec<String>,
    pub kinds: Vec<&'static str>,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub known: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fuller: Vec<String>,
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

#[derive(Deserialize)]
struct Shown {
    urn: String,
    title: String,
    #[serde(default)]
    user: Option<Uploader>,
    #[serde(default)]
    enrichment: Option<Enrichment>,
    #[serde(default)]
    playback_count: Option<u64>,
    #[serde(default)]
    likes_count: Option<u64>,
}

#[derive(Deserialize)]
struct Uploader {
    #[serde(default)]
    username: String,
}

#[derive(Deserialize)]
struct Enrichment {
    #[serde(default)]
    primary_artist: Option<Named>,
}

#[derive(Deserialize)]
struct Named {
    name: String,
}

pub fn request(variants: &[Variant], kinds: &[Kind]) -> Request {
    let lookup = Lookup {
        variants: variants.to_vec(),
        kinds: kinds.to_vec(),
    };
    Request {
        variants: lookup.texts(),
        kinds: kinds.iter().map(|k| k.name()).collect(),
        known: lookup.known(),
        fuller: lookup.fuller(),
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

pub fn shown(kind: Kind, page: &Value) -> Vec<Entity> {
    let Some(items) = page.get("collection").and_then(Value::as_array) else {
        return Vec::new();
    };
    items
        .iter()
        .filter_map(|item| serde_json::from_value::<Shown>(item.clone()).ok())
        .map(|hit| shown_entity(kind, hit))
        .collect()
}

fn shown_entity(kind: Kind, hit: Shown) -> Entity {
    let named = hit
        .enrichment
        .and_then(|e| e.primary_artist)
        .map(|a| a.name);
    let artist = named
        .or(hit.user.map(|u| u.username))
        .filter(|a| !a.trim().is_empty());
    Entity {
        kind,
        name: hit.title,
        artist,
        popularity: hit.playback_count.or(hit.likes_count).unwrap_or(0),
        id: hit.urn,
        aliases: Vec::new(),
        artist_aliases: Vec::new(),
    }
}

pub fn partial(body: &Value) -> bool {
    body.get("partial")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

pub fn timed_out(refusal: &Value) -> bool {
    refusal.get("code").and_then(Value::as_str) == Some("search_timeout")
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
    fn a_cut_reply_says_so_and_any_other_reply_is_whole() {
        let results = serde_json::json!({"artist": []});
        let reply = |said: Value| serde_json::json!({"results": results, "partial": said});
        assert!(partial(&reply(true.into())));
        assert!(!partial(&reply(false.into())));
        assert!(!partial(&reply("true".into())));
        assert!(!partial(&reply(Value::Null)));
        assert!(!partial(&serde_json::json!({"results": results})));
    }

    #[test]
    fn only_a_search_that_took_too_long_is_a_timeout() {
        let refusal =
            |code: &str| serde_json::json!({"statusCode": 503, "code": code, "message": "why"});
        assert!(timed_out(&refusal("search_timeout")));
        assert!(!timed_out(&refusal("search_busy")));
        assert!(!timed_out(&serde_json::json!({"statusCode": 503})));
        assert!(!timed_out(&Value::Null));
    }

    #[test]
    fn unknown_kinds_and_broken_rows_are_skipped() {
        let body = serde_json::json!({"results": {"user": [{"id": "u", "kind": "user", "name": "x"}], "track": [{"name": "no id"}]}});
        assert!(entities(&body).is_empty());
    }

    #[test]
    fn an_app_search_page_becomes_entities_of_its_shelf() {
        let tracks = serde_json::json!({"collection": [
            {"urn": "soundcloud:tracks:2", "title": "gothrussia", "user": {"username": "Psychosis"}, "playback_count": 23000},
            {"urn": "soundcloud:tracks:3", "title": "Притон", "user": {"username": "Label"}, "enrichment": {"primary_artist": {"name": "Скриптонит"}}},
            {"title": "no urn"}
        ], "has_more": false});
        let found = shown(Kind::Track, &tracks);
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].id, "soundcloud:tracks:2");
        assert_eq!(found[0].artist.as_deref(), Some("Psychosis"));
        assert_eq!(found[0].popularity, 23000);
        assert_eq!(found[1].artist.as_deref(), Some("Скриптонит"));
        let playlists = serde_json::json!({"collection": [
            {"urn": "soundcloud:playlists:7", "title": "Качалка", "user": {"username": ""}, "likes_count": 40}
        ]});
        let list = shown(Kind::Playlist, &playlists);
        assert_eq!(
            (list[0].kind, list[0].artist.clone(), list[0].popularity),
            (Kind::Playlist, None, 40)
        );
        assert!(shown(Kind::Track, &serde_json::json!({"error": "x"})).is_empty());
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
        assert!(body.get("fuller").is_none());
    }

    #[test]
    fn a_variant_that_says_more_than_the_name_is_sent_as_fuller() {
        let fuller = Variant {
            kept_fillers: true,
            ..said("для тебя звери", None)
        };
        let variants = vec![
            said("Звери", Some(Kind::Artist)),
            said("звери", None),
            fuller,
        ];
        let request = request(&variants, &Kind::ALL);
        assert!(request.known);
        let body = serde_json::to_value(&request).unwrap();
        assert_eq!(body["fuller"], serde_json::json!(["для тебя звери"]));
    }
}
