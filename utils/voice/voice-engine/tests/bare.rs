mod common;

use common::{Rig, rig_with, silent, timing};
use serde_json::json;
use voice_engine::{Command, CommandEvent, Config, DecisionEvent, State};
use voice_resolve::FixtureCatalog;

const CATALOG: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
track\tПривет\tZivert\t4000000\t
track\tАло\tМакс Корж\t1500000\t
track\tКак дела\tT-Fest\t3000000\t
track\tКак дела\tKIZARU\t2800000\t
track\tСпасибо\tЗемфира\t2200000\t
track\tЧто нового\tЛСП\t600000\t
";

fn rig(chat: bool) -> Rig {
    let rig = rig_with(
        silent(),
        Box::new(FixtureCatalog::from_tsv(CATALOG, true)),
        std::env::temp_dir().join("voice-engine-no-models"),
        timing(),
    );
    let mut config = Config {
        enabled: true,
        llm: chat,
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    rig
}

fn heard(rig: &Rig, text: &str) -> CommandEvent {
    rig.text(text);
    rig.expect_state(State::Thinking);
    rig.command()
}

fn settled(rig: &Rig, text: &str) -> CommandEvent {
    let command = heard(rig, text);
    rig.done(&command.id, "");
    rig.expect_state(State::Idle);
    command
}

fn hits(command: &CommandEvent) -> Vec<String> {
    let label = |hit: &voice_engine::EntityEvent| format!("{} - {}", hit.artist, hit.name);
    command.candidates.iter().map(label).collect()
}

#[test]
fn with_the_chat_on_small_talk_that_is_also_a_title_goes_out_as_none_with_its_hits() {
    let rig = rig(true);
    let both = vec!["T-Fest - Как дела", "KIZARU - Как дела"];
    let cases = [
        ("привет", vec![]),
        ("ало", vec!["Макс Корж - Ало"]),
        ("как дела", both.clone()),
        ("привет, как дела?", both),
        ("спасибо", vec![]),
        ("что нового", vec!["ЛСП - Что нового"]),
    ];
    for (text, found) in cases {
        let command = settled(&rig, text);
        assert_eq!(command.intent, "none", "{text}");
        assert_eq!(command.decision, None, "{text}");
        assert_eq!(hits(&command), found, "{text}");
    }
}

#[test]
fn with_the_chat_off_the_same_phrases_are_read_as_before() {
    let rig = rig(false);
    for text in ["привет", "спасибо"] {
        let command = settled(&rig, text);
        assert_eq!(command.intent, "none", "{text}");
        assert!(command.candidates.is_empty(), "{text}");
    }
    for (text, artist) in [("ало", "Макс Корж"), ("что нового", "ЛСП")] {
        let command = settled(&rig, text);
        let Some(DecisionEvent::Act { pick }) = &command.decision else {
            panic!("{text}: expected act, got {:?}", command.decision);
        };
        assert_eq!(
            (command.intent, pick.entity.artist.as_str()),
            ("play", artist)
        );
        assert!(command.candidates.is_empty(), "{text}");
    }
    for text in ["как дела", "привет, как дела?"] {
        let rig = self::rig(false);
        let command = heard(&rig, text);
        let Some(DecisionEvent::Ask { first, second }) = &command.decision else {
            panic!("{text}: expected ask, got {:?}", command.decision);
        };
        assert_eq!(command.intent, "play", "{text}");
        assert_eq!(first.entity.artist, "T-Fest", "{text}");
        assert_eq!(second.as_ref().unwrap().entity.artist, "KIZARU", "{text}");
        assert!(command.candidates.is_empty(), "{text}");
        rig.expect_state(State::Asking);
    }
}

#[test]
fn an_artist_said_alone_plays_at_once_with_the_chat_on_or_off() {
    for chat in [true, false] {
        let command = settled(&rig(chat), "скриптонит");
        let Some(DecisionEvent::Act { pick }) = &command.decision else {
            panic!("expected act, got {:?}", command.decision);
        };
        assert_eq!((command.intent, pick.entity.kind), ("play", "artist"));
        assert!(command.candidates.is_empty());
    }
}

#[test]
fn a_phrase_with_a_verb_is_read_the_same_with_the_chat_on_or_off() {
    for chat in [true, false] {
        let rig = rig(chat);
        let missing = settled(&rig, "включи абырвалгович");
        assert_eq!(missing.intent, "play");
        assert_eq!(missing.decision, Some(DecisionEvent::NotFound));
        let sure = settled(&rig, "поставь трек что нового");
        assert_eq!(sure.intent, "play");
        assert!(matches!(sure.decision, Some(DecisionEvent::Act { .. })));
        let asked = heard(&rig, "включи как дела");
        assert_eq!(asked.intent, "play");
        assert!(matches!(asked.decision, Some(DecisionEvent::Ask { .. })));
        rig.expect_state(State::Asking);
        for command in [missing, sure, asked] {
            assert!(command.candidates.is_empty());
        }
    }
}

#[test]
fn the_hits_reach_the_ui_as_entities_and_are_left_out_when_there_are_none() {
    let rig = rig(true);
    let command = settled(&rig, "привет, как дела?");
    assert_eq!(
        serde_json::to_value(&command).unwrap(),
        json!({
            "id": command.id,
            "source": "typed",
            "heard": "привет, как дела?",
            "normalized": "привет как дела",
            "intent": "none",
            "kind_hint": null,
            "number": null,
            "decision": null,
            "candidates": [
                {
                    "kind": "track",
                    "name": "Как дела",
                    "artist": "T-Fest",
                    "popularity": 3000000,
                    "id": "track:4",
                },
                {
                    "kind": "track",
                    "name": "Как дела",
                    "artist": "KIZARU",
                    "popularity": 2800000,
                    "id": "track:5",
                },
            ],
        })
    );
    let plain = serde_json::to_value(settled(&rig, "спасибо")).unwrap();
    assert_eq!(plain["intent"], "none");
    assert!(plain.get("candidates").is_none());
}
