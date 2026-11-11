use voice_nlu::Intent;
use voice_resolve::{Bare, Boosts, Decision, FixtureCatalog, Outcome, interpret};

const BOTH: [Bare; 2] = [Bare::Popular, Bare::Certain];
const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tНервы\t\t2000000\t
track\tНервы\tАнет Сай\t2500000\t
track\tПривет\tZivert\t4000000\t
track\tАло\tМакс Корж\t1500000\t
track\tКак дела\tT-Fest\t3000000\t
track\tКак дела\tKIZARU\t2800000\t
track\tСпасибо\tЗемфира\t2200000\t
track\tЧто нового\tЛСП\t600000\t
track\tКукушка\tКино\t5000000\t
track\tКукушка\tПолина Гагарина\t1200000\t
track\tDu Hast\tRammstein\t30000000\t
track\tСинева\tНикто\t500\t
track\tХорошая\tЗиверт\t800000\t
track\tГоргород\tOxxxymiron\t2100000\t
album\tГоргород\tOxxxymiron\t2000000\t
playlist\tДля сна\t\t500000\t
";

fn heard_in(rows: &str, text: &str, bare: Bare) -> Outcome {
    let catalog = FixtureCatalog::from_tsv(rows, true);
    let mut steps = interpret(text, &catalog, &Boosts::none(), bare);
    assert_eq!(steps.len(), 1, "{text}");
    steps.remove(0)
}

fn heard(text: &str, bare: Bare) -> Outcome {
    heard_in(ROWS, text, bare)
}

fn told(outcome: &Outcome) -> String {
    let decision = match &outcome.decision {
        None => String::new(),
        Some(Decision::Act { pick }) => format!(" act {}", pick.entity.label()),
        Some(Decision::Ask { first, second }) => {
            let other = second.as_ref().map(|hit| hit.entity.label());
            format!(
                " ask {} | {}",
                first.entity.label(),
                other.unwrap_or_default()
            )
        }
        Some(Decision::NotFound) => " not_found".into(),
    };
    format!("{}{decision}", outcome.intent.name())
}

fn hits(outcome: &Outcome) -> Vec<String> {
    outcome.candidates.iter().map(|hit| hit.label()).collect()
}

fn handed(text: &str) -> Vec<String> {
    let outcome = heard(text, Bare::Certain);
    assert_eq!(outcome.intent, Intent::None, "{text}");
    assert!(outcome.decision.is_none(), "{text}");
    hits(&outcome)
}

#[test]
fn small_talk_that_is_also_a_title_is_handed_over_with_its_hits() {
    let both = ["T-Fest - Как дела", "KIZARU - Как дела"];
    assert_eq!(handed("ало"), ["Макс Корж - Ало"]);
    assert_eq!(handed("как дела"), both);
    assert_eq!(handed("привет, как дела?"), both);
    assert_eq!(handed("что нового"), ["ЛСП - Что нового"]);
}

#[test]
fn the_same_phrases_play_by_popularity_when_names_are_not_handed_over() {
    let asks = "play ask T-Fest - Как дела | KIZARU - Как дела";
    let cases = [
        ("ало", "play act Макс Корж - Ало"),
        ("как дела", asks),
        ("привет, как дела?", asks),
        ("что нового", "play act ЛСП - Что нового"),
    ];
    for (text, played) in cases {
        let outcome = heard(text, Bare::Popular);
        assert_eq!(told(&outcome), played, "{text}");
        assert!(outcome.candidates.is_empty(), "{text}");
    }
}

#[test]
fn words_the_parser_takes_for_politeness_are_never_looked_up() {
    for bare in BOTH {
        for text in ["привет", "спасибо"] {
            let outcome = heard(text, bare);
            assert_eq!(told(&outcome), "none", "{text}");
            assert!(outcome.candidates.is_empty(), "{text}");
        }
    }
}

#[test]
fn a_sure_artist_said_alone_plays_either_way() {
    for bare in BOTH {
        for text in ["скриптонит", "scriptonite", "привет, скриптонит"] {
            let outcome = heard(text, bare);
            assert_eq!(told(&outcome), "play act Скриптонит", "{text}");
            assert!(outcome.candidates.is_empty(), "{text}");
        }
    }
}

#[test]
fn an_artist_that_is_not_sure_is_handed_over() {
    let popular = heard("нервы", Bare::Popular);
    assert_eq!(told(&popular), "play ask Нервы | Анет Сай - Нервы");
    assert_eq!(handed("нервы"), ["Нервы", "Анет Сай - Нервы"]);
}

#[test]
fn a_title_said_with_its_artist_plays_either_way() {
    let cases = [
        ("кино кукушка", "play act Кино - Кукушка"),
        ("кукушка гагарина", "play act Полина Гагарина - Кукушка"),
        ("цоя кукушку", "play act Кино - Кукушка"),
        ("ЛСП - Что нового", "play act ЛСП - Что нового"),
        ("Что нового - ЛСП", "play act ЛСП - Что нового"),
        ("рамштайн дю хаст", "play act Rammstein - Du Hast"),
        ("ало макс корж", "play act Макс Корж - Ало"),
    ];
    for bare in BOTH {
        for (text, played) in cases {
            let outcome = heard(text, bare);
            assert_eq!(told(&outcome), played, "{text}");
            assert!(outcome.candidates.is_empty(), "{text}");
        }
    }
}

#[test]
fn the_title_alone_is_handed_over() {
    let both = ["Кино - Кукушка", "Полина Гагарина - Кукушка"];
    assert_eq!(handed("кукушка"), both);
    assert_eq!(handed("дю хаст"), ["Rammstein - Du Hast"]);
}

#[test]
fn an_artist_with_a_title_that_is_not_sure_is_handed_over() {
    let twice = ["Oxxxymiron - Горгород", "Oxxxymiron - Горгород"];
    let popular = heard("oxxxymiron горгород", Bare::Popular);
    assert_eq!(
        told(&popular),
        "play ask Oxxxymiron - Горгород | Oxxxymiron - Горгород"
    );
    assert_eq!(handed("oxxxymiron горгород"), twice);
    assert_eq!(told(&heard("никто синева", Bare::Popular)), "none");
    assert_eq!(handed("никто синева"), ["Никто - Синева"]);
}

#[test]
fn an_album_or_a_playlist_called_by_its_kind_plays_either_way() {
    let cases = [
        ("альбом горгород", "play act Oxxxymiron - Горгород"),
        ("плейлист для сна", "play act Для сна"),
    ];
    for bare in BOTH {
        for (text, played) in cases {
            let outcome = heard(text, bare);
            assert_eq!(told(&outcome), played, "{text}");
            assert!(outcome.candidates.is_empty(), "{text}");
        }
    }
}

#[test]
fn a_word_for_a_track_does_not_make_its_title_sure() {
    assert_eq!(handed("хорошая песня"), ["Зиверт - Хорошая"]);
    assert_eq!(handed("трек ало"), ["Макс Корж - Ало"]);
    assert_eq!(
        told(&heard("хорошая песня", Bare::Popular)),
        "play act Зиверт - Хорошая"
    );
}

#[test]
fn a_phrase_with_a_verb_is_read_the_same_either_way() {
    let cases = [
        (
            "включи как дела",
            "play ask T-Fest - Как дела | KIZARU - Как дела",
        ),
        ("поставь трек что нового", "play act ЛСП - Что нового"),
        ("включи абырвалгович", "none not_found"),
        ("пауза", "pause"),
    ];
    for bare in BOTH {
        for (text, read) in cases {
            let outcome = heard(text, bare);
            assert_eq!(told(&outcome), read, "{text}");
            assert!(outcome.candidates.is_empty(), "{text}");
        }
    }
}

#[test]
fn nothing_found_hands_over_nothing() {
    assert!(handed("абракадабра").is_empty());
}

#[test]
fn at_most_five_hits_are_handed_over_best_first() {
    let mut rows = String::from("kind\tname\tartist\tpopularity\taliases\n");
    for nth in 1..=7 {
        let plays = 8_000_000 / nth;
        rows.push_str(&format!("track\tДоброе утро\tПевец {nth}\t{plays}\t\n"));
    }
    let outcome = heard_in(&rows, "доброе утро", Bare::Certain);
    assert_eq!(told(&outcome), "none");
    let best = [1, 2, 3, 4, 5].map(|nth| format!("Певец {nth} - Доброе утро"));
    assert_eq!(hits(&outcome), best);
}
