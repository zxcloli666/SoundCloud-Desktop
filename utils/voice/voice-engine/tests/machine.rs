mod common;

use std::sync::Arc;
use std::time::Duration;

use common::{Offline, Rig, models_ready, models_root, refusing, rig, rig_with, silent, timing};
use voice_audio::{CaptureError, ErrorCode};
use voice_engine::{Command, Config, DecisionEvent, Event, Press, Presses, Source, State};
use voice_resolve::FixtureCatalog;

fn rig_without_chat() -> Rig {
    let rig = rig();
    let mut config = Config {
        enabled: true,
        llm: false,
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    rig
}

#[test]
fn typed_command_goes_out_and_waits_for_done() {
    let rig = rig();
    rig.text("пауза");
    assert_eq!(rig.state(), (State::Thinking, Source::Typed));
    let command = rig.command();
    assert_eq!(command.intent, "pause");
    assert_eq!(command.source, Source::Typed);
    assert_eq!(command.group, None);
    assert!(rig.quiet_for(Duration::from_millis(150)).is_none());
    rig.done(&command.id, "Пауза");
    rig.expect_state(State::Idle);
    assert!(!rig.calls.list().iter().any(|c| c.starts_with("speak")));
}

#[test]
fn steps_go_one_by_one_and_wait_for_each_done() {
    let rig = rig();
    rig.text("выключи повтор и перемешай");
    rig.expect_state(State::Thinking);
    let first = rig.command();
    assert_eq!(first.intent, "repeat_off");
    assert_eq!((first.step, first.steps), (Some(1), Some(2)));
    assert!(rig.quiet_for(Duration::from_millis(150)).is_none());
    rig.done("someone-else", "");
    assert!(rig.quiet_for(Duration::from_millis(150)).is_none());
    rig.done(&first.id, "Повтор выключен");
    let second = rig.command();
    assert_eq!(second.intent, "shuffle_on");
    assert_eq!((second.step, second.steps), (Some(2), Some(2)));
    assert_eq!(second.group, first.group);
    assert_ne!(second.id, first.id);
    rig.done(&second.id, "Перемешала");
    rig.expect_state(State::Idle);
}

#[test]
fn close_titles_ask_and_the_answer_comes_back_as_a_new_command() {
    let rig = rig_without_chat();
    rig.text("включи хочу");
    rig.expect_state(State::Thinking);
    let asked = rig.command();
    let Some(DecisionEvent::Ask { first, second }) = asked.decision else {
        panic!("expected ask, got {:?}", asked.decision);
    };
    assert_eq!(first.entity.name, "Хочу");
    assert_eq!(second.unwrap().entity.artist, "Мот");
    rig.expect_state(State::Asking);
    rig.engine.send(Command::Answer("second".into()));
    rig.expect_state(State::Thinking);
    let picked = rig.command();
    assert_ne!(picked.id, asked.id);
    assert_eq!(picked.intent, "play");
    let Some(DecisionEvent::Act { pick }) = picked.decision else {
        panic!("expected act");
    };
    assert_eq!(pick.entity.artist, "Мот");
    rig.done(&picked.id, "");
    rig.expect_state(State::Idle);
}

#[test]
fn an_ask_that_timed_out_can_still_be_answered() {
    let rig = rig_without_chat();
    rig.text("включи хочу");
    rig.expect_state(State::Thinking);
    rig.command();
    rig.expect_state(State::Asking);
    rig.expect_state(State::Idle);
    rig.engine.send(Command::Answer("first".into()));
    rig.expect_state(State::Thinking);
    let picked = rig.command();
    let Some(DecisionEvent::Act { pick }) = picked.decision else {
        panic!("expected act");
    };
    assert_eq!(pick.entity.artist, "Земфира");
}

#[test]
fn an_answer_by_text_while_asking_picks_by_name() {
    let rig = rig_without_chat();
    rig.text("включи хочу");
    rig.expect_state(State::Thinking);
    rig.command();
    rig.expect_state(State::Asking);
    rig.text("второй");
    rig.expect_state(State::Thinking);
    let picked = rig.command();
    let Some(DecisionEvent::Act { pick }) = picked.decision else {
        panic!("expected act");
    };
    assert_eq!(pick.entity.artist, "Мот");
}

#[test]
fn nothing_found_is_a_play_with_not_found() {
    let rig = rig_without_chat();
    rig.text("включи абырвалгович");
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "play");
    assert_eq!(command.decision, Some(DecisionEvent::NotFound));
}

#[test]
fn remote_commands_keep_their_id() {
    let rig = rig();
    rig.engine.send(Command::Text {
        text: "следующий трек".into(),
        source: Source::Remote,
        id: Some("r-42".into()),
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "next");
    assert_eq!(command.remote_id.as_deref(), Some("r-42"));
    assert_eq!(command.source, Source::Remote);
}

#[test]
fn json_shape_matches_the_ui() {
    let rig = rig();
    rig.text("включи скриптонита");
    rig.expect_state(State::Thinking);
    let command = rig.command();
    let json = serde_json::to_value(&command).unwrap();
    assert_eq!(json["intent"], "play");
    assert_eq!(json["source"], "typed");
    assert_eq!(json["decision"]["decision"], "act");
    assert_eq!(json["decision"]["pick"]["entity"]["kind"], "artist");
    assert_eq!(json["decision"]["pick"]["entity"]["name"], "Скриптонит");
    assert_eq!(json["decision"]["pick"]["entity"]["artist"], "");
    assert!(json["decision"]["pick"]["score"].is_number());
    assert!(json["kind_hint"].is_null());
    assert!(json.get("group").is_none());
    assert!(json.get("remote_id").is_none());
}

#[test]
fn a_missing_done_ends_the_turn() {
    let rig = rig();
    rig.text("пауза");
    rig.expect_state(State::Thinking);
    rig.command();
    rig.expect_state(State::Idle);
}

#[test]
fn without_star_nothing_runs() {
    let rig = rig();
    rig.engine.send(Command::Star(false));
    rig.expect_state(State::Idle);
    rig.text("пауза");
    assert_eq!(rig.error(), "not_star");
    rig.engine.send(Command::Start(Source::Button));
    assert_eq!(rig.error(), "not_star");
}

#[test]
fn missing_models_refuse_to_listen() {
    let rig = rig();
    rig.engine.send(Command::Start(Source::Button));
    assert_eq!(rig.error(), "no_models");
    rig.expect_state(State::Idle);
}

#[test]
fn a_catalog_that_cannot_be_reached_is_a_network_error() {
    let rig = rig_with(
        silent(),
        Arc::new(Offline),
        std::env::temp_dir().join("voice-engine-no-models"),
        timing(),
    );
    rig.text("включи басту");
    rig.expect_state(State::Thinking);
    assert_eq!(rig.error(), "network");
    rig.expect_state(State::Idle);
}

#[test]
fn a_preview_plays_through_the_output() {
    let rig = rig();
    let mut wav = Vec::new();
    {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 22_050,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::new(std::io::Cursor::new(&mut wav), spec).unwrap();
        for i in 0..2205 {
            writer
                .write_sample(((i as f32 * 0.05).sin() * 8000.0) as i16)
                .unwrap();
        }
        writer.finalize().unwrap();
    }
    rig.engine.send(Command::Preview(wav));
    rig.expect_state(State::Idle);
    assert!(
        rig.calls
            .list()
            .contains(&"speak 2205 at 22050".to_string())
    );
}

#[test]
fn headset_presses_count_inside_the_window() {
    let start = std::time::Instant::now();
    let at = |ms: u64| start + Duration::from_millis(ms);
    let mut presses = Presses::default();
    assert_eq!(presses.press(2, at(0)), Press::First);
    assert_eq!(presses.press(2, at(300)), Press::Gesture);
    assert_eq!(presses.press(2, at(600)), Press::First);
    assert_eq!(presses.press(2, at(1200)), Press::First);

    let mut presses = Presses::default();
    assert_eq!(presses.press(3, at(0)), Press::First);
    assert_eq!(presses.press(3, at(400)), Press::More);
    assert_eq!(presses.press(3, at(800)), Press::Gesture);
    assert_eq!(presses.press(3, at(900)), Press::First);

    let mut presses = Presses::default();
    assert_eq!(presses.press(3, at(0)), Press::First);
    assert_eq!(presses.press(3, at(500)), Press::First);
    assert_eq!(presses.press(0, at(600)), Press::More);
}

#[test]
fn silence_ends_listening_without_a_command() {
    if !models_ready() {
        return;
    }
    let rig = rig_with(
        silent(),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        timing(),
    );
    rig.engine.send(Command::Start(Source::Button));
    assert_eq!(rig.state(), (State::Listening, Source::Button));
    rig.expect_state(State::Idle);
    let calls = rig.calls.list();
    assert_eq!(calls.first().map(String::as_str), Some("reference true"));
    assert!(calls.contains(&"duck 0.30".to_string()));
    assert_eq!(calls.last().map(String::as_str), Some("duck 1.00"));
    assert!(calls.contains(&"reference false".to_string()));
}

#[test]
fn a_denied_microphone_is_mic_denied() {
    if !models_ready() {
        return;
    }
    let rig = rig_with(
        refusing(CaptureError::new(ErrorCode::MicDenied, "access denied")),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        timing(),
    );
    rig.engine.send(Command::Start(Source::Hotkey));
    assert_eq!(rig.error(), "mic_denied");
    rig.expect_state(State::Idle);
}

#[test]
fn hold_mode_listens_while_held_and_ignores_key_repeat() {
    if !models_ready() {
        return;
    }
    let mut slow = timing();
    slow.no_speech = Duration::from_secs(10);
    let rig = rig_with(
        silent(),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        slow,
    );
    rig.engine.send(Command::Press(Source::Hotkey));
    assert_eq!(rig.state(), (State::Listening, Source::Hotkey));
    rig.engine.send(Command::Release(Source::Hotkey));
    rig.engine.send(Command::Press(Source::Hotkey));
    assert!(rig.quiet_for(Duration::from_millis(300)).is_none());
    std::thread::sleep(Duration::from_millis(100));
    rig.engine.send(Command::Release(Source::Hotkey));
    rig.expect_state(State::Idle);
}

#[test]
fn tap_mode_second_press_ends_listening() {
    if !models_ready() {
        return;
    }
    let mut slow = timing();
    slow.no_speech = Duration::from_secs(10);
    let rig = rig_with(
        silent(),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        slow,
    );
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.activation.hold = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    rig.engine.send(Command::Press(Source::Hotkey));
    rig.expect_state(State::Listening);
    rig.engine.send(Command::Release(Source::Hotkey));
    assert!(rig.quiet_for(Duration::from_millis(300)).is_none());
    rig.engine.send(Command::Press(Source::Hotkey));
    rig.expect_state(State::Idle);
}

#[test]
fn cancel_stops_listening_and_releases_the_duck() {
    if !models_ready() {
        return;
    }
    let mut slow = timing();
    slow.no_speech = Duration::from_secs(10);
    let rig = rig_with(
        silent(),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        slow,
    );
    rig.engine.send(Command::Start(Source::Hud));
    rig.expect_state(State::Listening);
    rig.engine.send(Command::Cancel);
    rig.expect_state(State::Idle);
    let calls = rig.calls.list();
    assert!(calls.contains(&"reference false".to_string()));
    assert_eq!(calls.last().map(String::as_str), Some("duck 1.00"));
    assert!(matches!(
        rig.quiet_for(Duration::from_millis(300)),
        None | Some(Event::Level(_))
    ));
}
