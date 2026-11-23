use voice_nlu::{Kind, Names};
use voice_resolve::{Bare, Boosts, Decision, Entity, Library, interpret};

const OWN: &str = "soundcloud:tracks:1";

fn track(name: &str, artist: &str, plays: u64, id: u64) -> Entity {
    Entity {
        kind: Kind::Track,
        name: name.into(),
        artist: Some(artist.into()),
        popularity: plays,
        id: format!("soundcloud:tracks:{id}"),
        aliases: Vec::new(),
        artist_aliases: Vec::new(),
    }
}

fn read(mut entity: Entity, said: &[&str], artist_said: &[&str]) -> Entity {
    entity.aliases = said.iter().map(|s| s.to_string()).collect();
    entity.artist_aliases = artist_said.iter().map(|s| s.to_string()).collect();
    entity
}

fn rows(readings: bool) -> Vec<Entity> {
    let own = |name: &str, plays: u64, id: u64| track(name, "Psychosis", plays, id);
    let mut rows = vec![
        own("gothrussia", 5_000, 1),
        own("goth tape (Bonus)", 3_000, 2),
        track("Psychosis - glass", "reup one", 9_000, 3),
        track("Psychosis - грааль", "reup one", 12_000, 4),
        track("psychosis - снег", "fan archive", 7_000, 5),
        track("psychosis - пепел", "reup two", 6_000, 6),
        track("Psychosis - carnival", "reup three", 4_000, 7),
        track("Psychosis - туман", "reup one", 8_000, 8),
        track("Psychosis - зима", "reup one", 8_500, 9),
        track("Psychosis - no sleep", "reup one", 5_500, 10),
        own("silver line", 6_500, 11),
        own("angel dust", 7_500, 12),
        own("fading", 2_500, 13),
        own("outsider", 3_500, 14),
        track("Nova - Goth Radio", "night shift", 1_000, 15),
        track("Goth Girl (feat. lil test)", "onlyone", 2_000, 16),
        track("k1d - CRY AND RUN", "scarygoths", 1_500, 17),
        track("Psychosis - они рядом", "fan two", 900, 18),
        track("Psychosis, Guest - Lost", "reup one", 2_200, 19),
        track("Psychosis - Antisocial Nights", "grail keeper", 1_800, 20),
    ];
    if readings {
        rows[0] = read(rows[0].clone(), &["гот раша"], &["психосис"]);
        rows[2] = read(rows[2].clone(), &["Психосис гласс"], &[]);
    }
    rows
}

fn picked(readings: bool, said: &str) -> String {
    let library = Library::new(rows(readings));
    let names = Names::new(&["Loli", "Лоля"]);
    let steps = interpret(said, &library, &Boosts::none(), Bare::Popular, &names);
    match steps.first().and_then(|s| s.decision.as_ref()) {
        Some(Decision::Act { pick }) => pick.entity.id.clone(),
        Some(Decision::Ask { first, second }) => format!(
            "ask {} {:?}",
            first.entity.id,
            second.as_ref().map(|s| s.entity.id.clone())
        ),
        _ => "none".into(),
    }
}

#[test]
fn a_misheard_title_picks_the_artists_own_track_over_a_reupload_named_after_the_artist() {
    for readings in [true, false] {
        for said in ["включи психосис гото раша", "включи психосис гот раша"]
        {
            assert_eq!(picked(readings, said), OWN, "{said} readings={readings}");
        }
    }
}
