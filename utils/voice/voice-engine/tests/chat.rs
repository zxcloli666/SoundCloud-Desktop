mod common;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use common::{Rig, rig_speaking, timing};
use voice_engine::{Chat, Command, Event, Sink, Source, State, Timing, Voice};

const RATE: u32 = 24000;
const PER_CHAR: usize = 240;
const CHUNK: usize = 480;
const BROKEN: &str = "сломайся";
const LONG: &str =
    "Это довольно длинная фраза, чтобы речь шла заметное время и её можно было оборвать.";

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

struct Restarted {
    wait: Duration,
}

impl Voice for Restarted {
    fn rate(&self) -> u32 {
        RATE
    }

    fn say(&mut self, text: &str, sink: &mut dyn Sink) -> Result<(), String> {
        std::thread::sleep(self.wait);
        sink.again();
        std::thread::sleep(self.wait);
        sink.audio(vec![tone(text); length(text)]);
        Ok(())
    }
}

struct Halting;

impl Voice for Halting {
    fn rate(&self) -> u32 {
        RATE
    }

    fn say(&mut self, _: &str, sink: &mut dyn Sink) -> Result<(), String> {
        let part = |level: f32, seconds: f32| vec![level; (RATE as f32 * seconds) as usize];
        sink.audio([part(0.5, 0.6), part(0.0005, 0.5), part(0.5, 0.6)].concat());
        Ok(())
    }
}

fn pause_between_words(heard: &[f32]) -> f32 {
    let spoken = |sample: &f32| sample.abs() > 0.1;
    let first = heard.iter().position(spoken).unwrap_or(0);
    let mut longest = 0;
    let mut run = 0;
    for sample in &heard[first..] {
        if spoken(sample) {
            longest = longest.max(run);
            run = 0;
        } else {
            run += 1;
        }
    }
    longest as f32 / RATE as f32
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
    stream(
        &rig,
        &id,
        &[
            "Привет! Как де",
            "ла у тебя? Сейчас вклю",
            "чу что-нибудь. Вот",
        ],
    );
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    let lines = [
        "Привет!",
        "Как дела у тебя?",
        "Сейчас включу что-нибудь.",
        "Вот",
    ];
    assert_eq!(said.list(), lines);
    assert_eq!(rig.heard.tones(), lines.map(tone));
    assert_eq!(
        rig.heard.voiced(),
        lines.iter().map(|l| length(l)).sum::<usize>()
    );
    assert_eq!(streams(&rig), 1);
    assert_eq!(
        rig.calls.list().last().map(String::as_str),
        Some("duck 1.00")
    );
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
fn an_opening_that_comes_in_time_is_spoken_whole() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    let start = "Сейчас поищу что-нибудь подходящее под настроение, подожди";
    stream(&rig, &id, &[start, " секунду. Вот"]);
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), [&format!("{start} секунду."), "Вот"]);
}

#[test]
fn an_opening_that_is_late_starts_with_its_first_clause() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    rig.chat(&id, Chat::Open { speak: true });
    let start = "Сейчас поищу что-нибудь подходящее под настроение, подожди";
    rig.chat(&id, Chat::Text(start.into()));
    rig.expect_state(State::Speaking);
    let clause = "Сейчас поищу что-нибудь подходящее под настроение,";
    assert_eq!(said.list(), [clause]);
    rig.chat(&id, Chat::Text(" секунду.".into()));
    rig.chat(&id, Chat::Close);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), [clause, "подожди секунду."]);
}

#[test]
fn the_end_of_a_spoken_reply_tells_how_the_speech_went() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Привет! Как дела у тебя?"]);
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    let spoke = rig.spoke.lock().unwrap().clone();
    assert_eq!(spoke.len(), 1, "{spoke:?}");
    assert_eq!((spoke[0].lines, spoke[0].chars), (2, 23));
    let sound = (length("Привет!") + length("Как дела у тебя?")) as f32 / RATE as f32;
    assert!((spoke[0].voiced.as_secs_f32() - sound).abs() < 0.001);
    assert!(spoke[0].first < Duration::from_secs(2));
}

#[test]
fn a_long_pause_of_the_voice_is_shortened_on_the_way_to_the_speaker() {
    let rig = rig_speaking(Halting, timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Раз и два."]);
    rig.expect_state(State::Speaking);
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    let pause = pause_between_words(&rig.heard.samples());
    assert!((0.2..0.3).contains(&pause), "{pause}");
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
    rig.chat(
        &id,
        Chat::Text(format!("{LONG} И ещё одна такая же длинная фраза следом. ")),
    );
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
fn cancel_by_id_stops_a_reply_that_outlived_its_turn() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &[LONG, " ", LONG, " ", LONG]);
    rig.done(&id, "");
    rig.expect_state(State::Speaking);
    rig.chat("another", Chat::Cancel);
    assert!(rig.quiet_for(Duration::from_millis(100)).is_none());
    rig.chat(&id, Chat::Cancel);
    rig.expect_state(State::Idle);
    assert!(rig.calls.list().contains(&"hush".to_string()));
    assert!(rig.quiet_for(Duration::from_millis(300)).is_none());
    assert!(rig.heard.voiced() < length(LONG) * 3);
}

#[test]
fn a_chat_cancel_does_not_stop_a_reply_to_something_else() {
    let (rig, _) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &["Готово."]);
    rig.done(&id, "");
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    rig.done(&rig.command().id, LONG);
    rig.expect_state(State::Speaking);
    rig.chat(&id, Chat::Cancel);
    rig.expect_state(State::Idle);
    assert_eq!(rig.heard.voiced(), length("Готово.") + length(LONG));
}

#[test]
fn a_turn_cancelled_between_rounds_takes_no_more_rounds() {
    let (rig, said) = speaking(timing());
    let id = asked(&rig, Source::Button);
    stream(&rig, &id, &[LONG, " ", LONG]);
    rig.expect_state(State::Speaking);
    rig.chat(&id, Chat::Cancel);
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Thinking);
    stream(&rig, &id, &["Нашла три альбома."]);
    assert_eq!(rig.cancelled(), id);
    assert!(rig.quiet_for(Duration::from_millis(300)).is_none());
    rig.done(&id, "");
    rig.expect_state(State::Idle);
    assert!(said.list().iter().all(|line| line == LONG));
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
    rig.done(
        &command.id,
        "Ставлю на паузу. Потом продолжу, если захочешь.",
    );
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    assert_eq!(
        said.list(),
        ["Ставлю на паузу. Потом продолжу, если захочешь."]
    );
    assert_eq!(streams(&rig), 1);
}

#[test]
fn a_voice_that_starts_the_phrase_over_is_waited_for_anew() {
    let mut brief = timing();
    brief.synth = Duration::from_secs(4);
    let wait = Duration::from_millis(2500);
    let rig = rig_speaking(Restarted { wait }, brief);
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    rig.done(&command.id, "Ставлю на паузу.");
    rig.expect_state(State::Speaking);
    rig.expect_state(State::Idle);
    assert_eq!(rig.heard.voiced(), length("Ставлю на паузу."));
}
