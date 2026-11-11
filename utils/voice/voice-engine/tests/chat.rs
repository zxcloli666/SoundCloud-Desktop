mod common;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use common::{Rig, rig_speaking, timing};
use voice_engine::{Chat, Command, Event, Sink, Source, State, Timing, Voice};

const RATE: u32 = 24000;
const PER_CHAR: usize = 240;
const CHUNK: usize = 480;
const BROKEN: &str = "сломайся";
const LONG: &str = "Это довольно длинная фраза, чтобы речь шла заметное время и её можно было оборвать.";

#[derive(Clone, Default)]
struct Said(Arc<Mutex<Vec<String>>>);

impl Said {
    fn list(&self) -> Vec<String> {
        self.0.lock().unwrap().clone()
    }
}

struct Tone {
    said: Said,
    pause: Duration,
}

impl Voice for Tone {
    fn rate(&self) -> u32 {
        RATE
    }

    fn say(&mut self, text: &str, sink: &mut dyn Sink) -> Result<(), String> {
        self.said.0.lock().unwrap().push(text.to_string());
        if text.contains(BROKEN) {
            return Err("no voice".into());
        }
        let samples = vec![tone(text); length(text)];
        for chunk in samples.chunks(CHUNK) {
            if !sink.wanted() {
                return Ok(());
            }
            sink.audio(chunk.to_vec());
            std::thread::sleep(self.pause);
        }
        Ok(())
    }
}

fn length(text: &str) -> usize {
    text.chars().count() * PER_CHAR
}

fn tone(text: &str) -> f32 {
    text.chars().count() as f32 / 100.0
}

fn speaking(timing: Timing) -> (Rig, Said) {
    let said = Said::default();
    let voice = Tone {
        said: said.clone(),
        pause: Duration::from_millis(2),
    };
    (rig_speaking(voice, timing), said)
}

fn asked(rig: &Rig, source: Source) -> String {
    rig.engine.send(Command::Text {
        text: "как твои дела".into(),
        source,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "none");
    command.id
}

fn stream(rig: &Rig, id: &str, pieces: &[&str]) {
    rig.chat(id, Chat::Open { speak: true });
    for piece in pieces {
        rig.chat(id, Chat::Text(piece.to_string()));
    }
    rig.chat(id, Chat::Close);
}

fn streams(rig: &Rig) -> usize {
    let calls = rig.calls.list();
    calls.iter().filter(|c| c.starts_with("speak ")).count()
}

#[test]
fn a_streamed_reply_is_spoken_sentence_by_sentence_in_order() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Привет! Как де", "ла у тебя? Сейчас вклю", "чу что-нибудь. Вот"]);
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    let lines = ["Привет!", "Как дела у тебя?", "Сейчас включу что-нибудь.", "Вот"];
    assert_eq!(said.list(), lines);
    assert_eq!(rig.heard.tones(), lines.map(tone));
    assert_eq!(rig.heard.voiced(), lines.iter().map(|l| length(l)).sum::<usize>());
    assert_eq!(streams(&rig), 1);
    assert_eq!(rig.calls.list().last().map(String::as_str), Some("duck 1.00"));
}

#[test]
fn speech_starts_while_the_text_is_still_coming() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: true });
    rig.chat(&id, Chat::Text("Сейчас найду. А по".into()));
    rig.expect_state(State::Speaking);
    assert_eq!(said.list(), ["Сейчас найду."]);
    rig.chat(&id, Chat::Text("том включу.".into()));
    rig.chat(&id, Chat::Close);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), ["Сейчас найду.", "А потом включу."]);
    assert_eq!(streams(&rig), 1);
}

#[test]
fn finishing_the_step_does_not_cut_the_reply() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &[LONG]);
    rig.done(&id, "");
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    assert_eq!(rig.heard.voiced(), length(LONG));
}

#[test]
fn rounds_of_one_turn_follow_each_other_in_one_stream() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Сейчас поищу."]);
    rig.expect_state(State::Speaking);
    stream(&rig, &id, &["Нашла три трека. Включаю первый."]);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    let lines = ["Сейчас поищу.", "Нашла три трека.", "Включаю первый."];
    assert_eq!(said.list(), lines);
    assert_eq!(rig.heard.tones(), lines.map(tone));
    assert_eq!(streams(&rig), 1);
}

#[test]
fn the_reply_of_the_step_follows_the_streamed_text() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Сделала потише."]);
    rig.done(&id, "Готово");
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), ["Сделала потише.", "Готово"]);
    assert_eq!(streams(&rig), 1);
}

#[test]
fn cancel_stops_the_speech_and_tells_the_network_side() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: true });
    rig.chat(&id, Chat::Text(format!("{LONG} И ещё одна такая же длинная фраза следом. ")));
    rig.expect_state(State::Speaking);
    rig.engine.send(Command::Cancel);
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Idle);
    assert!(rig.calls.list().contains(&"hush".to_string()));
    rig.chat(&id, Chat::Text("Поздно.".into()));
    rig.chat(&id, Chat::Close);
    assert!(rig.quiet_for(Duration::from_millis(300)).is_none());
    assert!(rig.heard.voiced() < length(LONG));
}

#[test]
fn a_new_listen_cancels_the_turn() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Сейчас расскажу длинную историю про музыку."]);
    rig.expect_state(State::Speaking);
    rig.engine.send(Command::Start(Source::Button));
    assert_eq!(rig.cancelled(), id);
    assert_eq!(rig.error(), "no_models");
    rig.expect_state(State::Idle);
    assert!(rig.calls.list().contains(&"hush".to_string()));
}

#[test]
fn typed_text_cancels_the_turn() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: true });
    rig.text("пауза");
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Thinking);
    assert_eq!(rig.command().intent, "pause");
}

#[test]
fn cancelling_the_turn_keeps_the_step_waiting_for_its_done() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Сейчас расскажу длинную историю про музыку."]);
    rig.expect_state(State::Speaking);
    rig.chat(&id, Chat::Cancel);
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Thinking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list().len(), 1);
}

#[test]
fn a_turn_outlives_the_step_deadline_and_ends_when_nothing_arrives() {
    let mut brief = timing();
    brief.done = Duration::from_millis(400);
    brief.chat = Duration::from_millis(2000);
    let (rig, _) = speaking(brief);
    let id = asked(&rig, Source::Typed);
    rig.chat(&id, Chat::Open { speak: false });
    assert!(rig.quiet_for(Duration::from_millis(1000)).is_none());
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Idle);
}

#[test]
fn the_watchdog_waits_for_a_reply_that_is_still_spoken() {
    let mut brief = timing();
    brief.chat = Duration::from_millis(200);
    let (rig, _) = speaking(brief);
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &[LONG]);
    rig.expect_state(State::Speaking);
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Idle);
    assert_eq!(rig.heard.voiced(), length(LONG));
}

#[test]
fn a_turn_for_a_step_that_is_gone_is_refused() {
    let (rig, _) = speaking(timing());
    rig.chat("nobody", Chat::Open { speak: true });
    assert_eq!(rig.cancelled(), "nobody");
    let id = asked(&rig, Source::Button);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    rig.chat(&id, Chat::Open { speak: true });
    assert_eq!(rig.cancelled(), id);
}

#[test]
fn a_typed_turn_is_not_voiced() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Typed);
    stream(&rig, &id, &["Привет! Это ответ на набранный текст."]);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert!(said.list().is_empty());
    assert_eq!(streams(&rig), 0);
}

#[test]
fn a_turn_that_must_not_speak_stays_silent() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: false });
    rig.chat(&id, Chat::Text("Привет! Это ответ без голоса.".into()));
    rig.chat(&id, Chat::Close);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert!(said.list().is_empty());
}

#[test]
fn a_broken_round_drops_its_unfinished_sentence() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: true });
    rig.chat(&id, Chat::Text("Сейчас включу. А потом ещё".into()));
    rig.chat(&id, Chat::Cut);
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), ["Сейчас включу."]);
}

#[test]
fn a_voice_failure_is_reported_once_and_the_turn_goes_on() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &[&format!("Раз. Это {BROKEN}. Три. Четыре.")]);
    let mut errors = 0;
    loop {
        match rig.next() {
            Event::Error(error) => {
                assert_eq!(error.code, "tts_failed");
                errors += 1;
                rig.chat(&id, Chat::Open { speak: true });
                rig.chat(&id, Chat::Text("Пять. Шесть.".into()));
                rig.chat(&id, Chat::Close);
                rig.done(&id, "");
            }
            Event::State(state) if state.state == State::Idle => break,
            Event::State(_) => {}
            other => panic!("unexpected {other:?}"),
        }
    }
    assert_eq!(errors, 1);
    assert_eq!(said.list(), ["Раз.", &format!("Это {BROKEN}.")]);
}

#[test]
fn a_command_reply_is_still_one_phrase() {
    let (rig, said) = speaking(timing());
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    rig.done(&command.id, "Ставлю на паузу. Потом продолжу, если захочешь.");
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), ["Ставлю на паузу. Потом продолжу, если захочешь."]);
    assert_eq!(streams(&rig), 1);
}
