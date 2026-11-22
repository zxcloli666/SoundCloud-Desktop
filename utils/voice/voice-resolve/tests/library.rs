use voice_nlu::{Kind, Names, Variant};
use voice_resolve::{Bare, Boosts, Catalog, Decision, Entity, Library, interpret, matches, named};

fn entity(kind: Kind, name: &str, artist: Option<&str>, popularity: u64, id: &str) -> Entity {
    Entity {
        kind,
        name: name.into(),
        artist: artist.map(String::from),
        popularity,
        id: id.into(),
        aliases: Vec::new(),
        artist_aliases: Vec::new(),
    }
}

fn track(name: &str, artist: &str, plays: u64, id: &str) -> Entity {
    entity(Kind::Track, name, Some(artist), plays, id)
}

fn library() -> Library {
    Library::new(vec![
        track("Nightmare", "Psychosis", 41_000, "soundcloud:tracks:1"),
        track("gothrussia", "Psychosis", 23_000, "soundcloud:tracks:2"),
        track("Притон", "Скриптонит", 900_000, "soundcloud:tracks:3"),
        track("Komori", "Komori", 3_000, "soundcloud:tracks:4"),
        track("Группа крови", "Кино", 2_500_000, "soundcloud:tracks:5"),
    ])
}

fn server() -> Vec<Entity> {
    vec![
        entity(
            Kind::Artist,
            "Psychosis",
            None,
            120_000,
            "soundcloud:users:10",
        ),
        entity(Kind::Artist, "Кино", None, 9_000_000, "soundcloud:users:11"),
        entity(
            Kind::Artist,
            "Скриптонит",
            None,
            30_000_000,
            "soundcloud:users:12",
        ),
        track("Psycho", "Post Malone", 400_000_000, "soundcloud:tracks:20"),
        track("Сансара", "Баста", 60_000_000, "soundcloud:tracks:21"),
    ]
}

struct Both {
    server: Vec<Entity>,
    library: Library,
}

impl Catalog for Both {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        let served = self
            .server
            .iter()
            .filter(|e| kinds.contains(&e.kind))
            .cloned();
        let mine = self.library.candidates(variants, kinds);
        served.chain(mine).collect()
    }
}

fn played(text: &str) -> Option<String> {
    let both = Both {
        server: server(),
        library: library(),
    };
    let liked = Boosts::liked_artists(&["Psychosis".into()]);
    let names = Names::new(&["Loli", "Лоля"]);
    let outcomes = interpret(text, &both, &liked, Bare::Popular, &names);
    match &outcomes.first()?.decision {
        Some(Decision::Act { pick }) => Some(pick.entity.id.clone()),
        _ => None,
    }
}

fn found(said: &str) -> Option<String> {
    let both = Both {
        server: server(),
        library: library(),
    };
    let readings = named(said);
    let variants: Vec<Variant> = readings.iter().flat_map(|r| r.queries.clone()).collect();
    let all = both.candidates(&variants, &Kind::ALL);
    let fit = matches(&readings, &all, &Kind::ALL, &Boosts::none());
    fit.first().map(|s| s.entity.id.clone())
}

#[test]
fn a_library_track_said_by_sound_is_played() {
    for said in [
        "включи психосис гот раша",
        "включи гот раша",
        "поставь готраша",
    ] {
        assert_eq!(
            played(said).as_deref(),
            Some("soundcloud:tracks:2"),
            "{said}"
        );
    }
    assert_eq!(
        played("включи найтмер").as_deref(),
        Some("soundcloud:tracks:1")
    );
    assert_eq!(
        played("включи притон").as_deref(),
        Some("soundcloud:tracks:3")
    );
}

#[test]
fn an_artist_name_still_plays_the_artist_and_not_a_liked_track_of_theirs() {
    assert_eq!(
        played("включи кино").as_deref(),
        Some("soundcloud:users:11")
    );
    assert_eq!(
        played("включи скриптонита").as_deref(),
        Some("soundcloud:users:12")
    );
    assert_eq!(
        played("включи психосис").as_deref(),
        Some("soundcloud:users:10")
    );
}

#[test]
fn a_track_that_is_not_liked_is_still_found_on_the_server() {
    assert_eq!(
        played("включи басту сансара").as_deref(),
        Some("soundcloud:tracks:21")
    );
}

#[test]
fn the_chat_search_finds_library_tracks_too() {
    assert_eq!(
        found("психосис гот раша").as_deref(),
        Some("soundcloud:tracks:2")
    );
    assert_eq!(
        found("группа крови").as_deref(),
        Some("soundcloud:tracks:5")
    );
    assert_eq!(found("кино").as_deref(), Some("soundcloud:users:11"));
}

#[test]
fn the_library_answers_only_for_tracks_near_what_was_said() {
    let readings = named("баста сансара");
    let variants: Vec<Variant> = readings.iter().flat_map(|r| r.queries.clone()).collect();
    assert!(library().candidates(&variants, &Kind::ALL).is_empty());
    assert!(library().candidates(&variants, &[Kind::Artist]).is_empty());
}
