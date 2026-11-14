use std::cell::Cell;

use voice_nlu::{Kind, Names, Variant};
use voice_resolve::{Bare, Boosts, Catalog, Decision, Entity, FixtureCatalog, Outcome, interpret};

const BOTH: [Bare; 2] = [Bare::Popular, Bare::Certain];
const LOLI: [&str; 3] = ["Loli", "Лоля", "롤리"];
const MORIARTY: [&str; 3] = ["Moriarty", "Мориарти", "모리아티"];
const MICHAEL: [&str; 1] = ["Michael"];
const HEART: [&str; 1] = ["Heart"];
const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tЛоля\t\t300000\tloli
artist\tКино\t\t9000000\t
track\tПривет\tZivert\t4000000\t
track\tКак дела\tT-Fest\t3000000\t
artist\tMichael Jackson\t\t40000000\tмайкл джексон
artist\tJanet Jackson\t\t9000000\t
artist\tGeorge Michael\t\t12000000\t
artist\tQueen\t\t50000000\t
track\tHeart of Glass\tBlondie\t8000000\t
";

struct Counted {
    rows: FixtureCatalog,
    lookups: Cell<usize>,
}

impl Catalog for Counted {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        self.lookups.set(self.lookups.get() + 1);
        self.rows.candidates(variants, kinds)
    }
}

fn read(rows: &str, text: &str, bare: Bare, names: &[&str]) -> (String, usize) {
    let catalog = Counted {
        rows: FixtureCatalog::from_tsv(rows, true),
        lookups: Cell::new(0),
    };
    let steps = interpret(text, &catalog, &Boosts::none(), bare, &Names::new(names));
    let told: Vec<String> = steps.iter().map(told).collect();
    (told.join(" + "), catalog.lookups.get())
}

fn told(outcome: &Outcome) -> String {
    let decision = match &outcome.decision {
        None => String::new(),
        Some(Decision::Act { pick }) => format!(" act {}", pick.entity.label()),
        Some(Decision::Ask { first, .. }) => format!(" ask {}", first.entity.label()),
        Some(Decision::NotFound) => " not_found".into(),
    };
    let hits: Vec<String> = outcome.candidates.iter().map(Entity::label).collect();
    format!("{}{decision} {hits:?}", outcome.intent.name())
}

#[test]
fn a_name_said_to_the_assistant_is_never_looked_up_either_way() {
    let phrases = [
        "привет, лоля",
        "лоля, привет",
        "спасибо, лоля",
        "лоля",
        "loli, hi",
    ];
    for bare in BOTH {
        for text in phrases {
            assert_eq!(
                read(ROWS, text, bare, &LOLI),
                ("none []".into(), 0),
                "{text}"
            );
        }
    }
}

#[test]
fn a_command_with_the_name_is_read_as_the_command_without_it_either_way() {
    let cases = [
        ("лоля, включи кино", "включи кино", 0),
        ("включи кино, лоля", "включи кино", 1),
        ("лоля поставь на паузу", "поставь на паузу", 0),
        ("привет, лоля, как дела?", "привет, как дела?", 1),
    ];
    for bare in BOTH {
        for (text, plain, extra) in cases {
            let (told, lookups) = read(ROWS, text, bare, &LOLI);
            let (plain, looked) = read(ROWS, plain, bare, &[]);
            assert_eq!((told, lookups), (plain, looked + extra), "{text}");
        }
        assert_eq!(
            read(ROWS, "лоля, включи кино", bare, &LOLI).0,
            "play act Кино []"
        );
        assert_eq!(
            read(ROWS, "лоля поставь на паузу", bare, &LOLI).0,
            "pause []"
        );
    }
}

#[test]
fn a_name_that_is_the_object_of_a_command_is_looked_up_either_way() {
    let objects = ["включи лолю", "поставь loli", "включи исполнителя лоля"];
    for bare in BOTH {
        for text in objects {
            let (told, lookups) = read(ROWS, text, bare, &LOLI);
            assert_eq!(told, "play act Лоля []", "{text}");
            assert!(lookups > 0, "{text}");
        }
    }
}

#[test]
fn the_names_of_another_voice_change_nothing() {
    for bare in BOTH {
        for text in ["привет, лоля", "лоля", "включи кино, лоля"] {
            let other = read(ROWS, text, bare, &MORIARTY);
            assert_eq!(other, read(ROWS, text, bare, &[]), "{text}");
            assert!(other.1 > 0, "{text}");
        }
    }
    assert_eq!(
        read(ROWS, "привет, лоля", Bare::Popular, &MORIARTY).0,
        "play act Лоля []"
    );
}

#[test]
fn a_longer_name_with_the_name_of_the_voice_in_it_is_kept_either_way() {
    let cases = [
        (&MICHAEL[..], "michael jackson", "Michael Jackson", 1),
        (&MICHAEL[..], "play george michael", "George Michael", 1),
        (&HEART[..], "heart of glass", "Heart of Glass", 1),
        (&MICHAEL[..], "майкл джексон", "Michael Jackson", 0),
    ];
    for bare in BOTH {
        for (voice, text, found, extra) in cases {
            let (told, lookups) = read(ROWS, text, bare, voice);
            let (whole, looked) = read(ROWS, text, bare, &[]);
            assert_eq!((&told, lookups), (&whole, looked + extra), "{text}");
            assert!(told.contains(found), "{text}: {told}");
        }
        assert_eq!(
            read(ROWS, "play george michael", bare, &MICHAEL).0,
            "play act George Michael []"
        );
    }
}

#[test]
fn the_name_of_such_a_voice_said_to_it_is_left_out_either_way() {
    let cases = [
        (&MICHAEL[..], "michael, pause", "pause"),
        (&MICHAEL[..], "thanks michael", "thanks"),
        (&MICHAEL[..], "michael", ""),
        (&HEART[..], "heart, play queen", "play queen"),
    ];
    for bare in BOTH {
        for (voice, text, plain) in cases {
            let named = read(ROWS, text, bare, voice);
            assert_eq!(named, read(ROWS, plain, bare, &[]), "{text}");
        }
        assert_eq!(
            read(ROWS, "heart, play queen", bare, &HEART).0,
            "play act Queen []"
        );
    }
}
