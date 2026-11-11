mod common;

use std::sync::Arc;

use common::{Offline, Rig, rig_with, silent, timing};
use voice_engine::{Catalog, Command, CommandEvent, Config, DecisionEvent, State};
use voice_resolve::FixtureCatalog;

const LOLI: [&str; 3] = ["Loli", "Лоля", "롤리"];
const MORIARTY: [&str; 3] = ["Moriarty", "Мориарти", "모리아티"];
const MICHAEL: [&str; 1] = ["Michael"];
const HEART: [&str; 1] = ["Heart"];
const CATALOG: &str = "kind\tname\tartist\tpopularity\taliases
artist\tЛоля\t\t300000\tloli
artist\tКино\t\t9000000\t
track\tПривет\tZivert\t4000000\t
artist\tMichael Jackson\t\t40000000\tмайкл джексон
artist\tJanet Jackson\t\t9000000\t
artist\tGeorge Michael\t\t12000000\t
artist\tQueen\t\t50000000\t
track\tHeart of Glass\tBlondie\t8000000\t
";

fn rig(catalog: Arc<dyn Catalog>) -> Rig {
    let root = std::env::temp_dir().join("voice-engine-no-models");
    rig_with(silent(), catalog, root, timing())
}

fn fixture(chat: bool, names: &[&str]) -> Rig {
    let rig = rig(Arc::new(FixtureCatalog::from_tsv(CATALOG, true)));
    voice(&rig, chat, names);
    rig
}

fn voice(rig: &Rig, chat: bool, names: &[&str]) {
    let mut config = Config {
        enabled: true,
        llm: chat,
        names: names.iter().map(|name| name.to_string()).collect(),
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
}

fn settled(rig: &Rig, text: &str) -> CommandEvent {
    rig.text(text);
    rig.expect_state(State::Thinking);
    let command = rig.command();
    rig.done(&command.id, "");
    rig.expect_state(State::Idle);
    command
}

fn read(rig: &Rig, text: &str) -> CommandEvent {
    CommandEvent {
        id: String::new(),
        heard: String::new(),
        ..settled(rig, text)
    }
}

fn played(command: &CommandEvent) -> (&str, &str) {
    let Some(DecisionEvent::Act { pick }) = &command.decision else {
        panic!("expected act, got {:?}", command.decision);
    };
    (command.intent, pick.entity.name.as_str())
}

#[test]
fn a_name_said_to_the_assistant_goes_out_as_none_without_a_lookup_and_keeps_what_was_heard() {
    let phrases = [
        "привет, лоля",
        "лоля, привет",
        "спасибо, лоля",
        "лоля",
        "loli, hi",
    ];
    for chat in [true, false] {
        let rig = rig(Arc::new(Offline));
        voice(&rig, chat, &LOLI);
        for text in phrases {
            let command = settled(&rig, text);
            assert_eq!(command.intent, "none", "{text}");
            assert_eq!(command.decision, None, "{text}");
            assert!(command.candidates.is_empty(), "{text}");
            assert_eq!(command.heard, text);
        }
    }
}

#[test]
fn a_command_with_the_name_does_what_the_command_without_it_does() {
    let cases = [
        ("лоля, включи кино", "включи кино"),
        ("включи кино, лоля", "включи кино"),
        ("лоля поставь на паузу", "поставь на паузу"),
    ];
    for chat in [true, false] {
        let rig = fixture(chat, &LOLI);
        for (text, plain) in cases {
            assert_eq!(read(&rig, text), read(&rig, plain), "{text}");
        }
        assert_eq!(
            played(&settled(&rig, "лоля, включи кино")),
            ("play", "Кино")
        );
        assert_eq!(settled(&rig, "лоля поставь на паузу").intent, "pause");
    }
}

#[test]
fn a_name_that_is_the_object_of_a_command_plays_what_it_names() {
    let objects = ["включи лолю", "поставь loli", "включи исполнителя лоля"];
    for chat in [true, false] {
        let rig = fixture(chat, &LOLI);
        for text in objects {
            assert_eq!(played(&settled(&rig, text)), ("play", "Лоля"), "{text}");
        }
    }
}

#[test]
fn only_the_names_of_the_voice_in_use_are_left_out() {
    for chat in [true, false] {
        let rig = fixture(chat, &LOLI);
        assert_eq!(settled(&rig, "привет, лоля").intent, "none");
        voice(&rig, chat, &MORIARTY);
        let other = read(&rig, "привет, лоля");
        assert_eq!(other, read(&fixture(chat, &[]), "привет, лоля"));
        assert_eq!(played(&other), ("play", "Лоля"));
        assert_eq!(settled(&rig, "привет, мориарти").intent, "none");
    }
}

#[test]
fn a_longer_name_with_the_name_of_the_voice_in_it_is_kept_with_the_chat_on_or_off() {
    let cases = [
        (&MICHAEL[..], "michael jackson"),
        (&MICHAEL[..], "play george michael"),
        (&HEART[..], "heart of glass"),
        (&MICHAEL[..], "майкл джексон"),
    ];
    for chat in [true, false] {
        let rig = fixture(chat, &[]);
        let plain = fixture(chat, &[]);
        for (names, text) in cases {
            voice(&rig, chat, names);
            assert_eq!(read(&rig, text), read(&plain, text), "{text}");
        }
        voice(&rig, chat, &MICHAEL);
        let jackson = settled(&rig, "michael jackson");
        assert_eq!(played(&jackson), ("play", "Michael Jackson"));
        let george = settled(&rig, "play george michael");
        assert_eq!(played(&george), ("play", "George Michael"));
    }
}

#[test]
fn the_name_of_such_a_voice_said_to_it_is_left_out_with_the_chat_on_or_off() {
    let said = [
        ("michael, pause", "pause"),
        ("thanks michael", "none"),
        ("michael", "none"),
    ];
    for chat in [true, false] {
        let rig = rig(Arc::new(Offline));
        voice(&rig, chat, &MICHAEL);
        for (text, intent) in said {
            let command = settled(&rig, text);
            assert_eq!(command.intent, intent, "{text}");
            assert_eq!(command.decision, None, "{text}");
            assert!(command.candidates.is_empty(), "{text}");
        }
        let queen = fixture(chat, &HEART);
        let heard = read(&queen, "heart, play queen");
        assert_eq!(heard, read(&queen, "play queen"));
        assert_eq!(played(&heard), ("play", "Queen"));
    }
}
