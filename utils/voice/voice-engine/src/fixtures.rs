use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;

pub fn variant(text: &str) -> Variant {
    Variant {
        text: text.into(),
        artist: None,
        title: None,
        kept_fillers: false,
        lemmatized: false,
        fallback: false,
        alias_kind: None,
    }
}

pub fn entity(kind: Kind, name: &str) -> Entity {
    Entity {
        kind,
        name: name.into(),
        artist: None,
        popularity: 1,
        id: "a1".into(),
        aliases: Vec::new(),
        artist_aliases: Vec::new(),
    }
}
