mod common;

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use common::{Answer, FakeServer, Rig, SERVED, no_models, rig_served, store, timing};
use voice_engine::{
    Command, Config, ErrorEvent, Event, KOKORO, Sink, Source, State, Timing, Voice, hearing,
    required,
};

const LINE: &str = "Ставлю на паузу.";
const OTHER: &str = "Делаю громче.";
const BUSY: &str = "voice_speak_busy";
const LOCAL_LEVEL: f32 = 0.5;
const LOCAL_LENGTH: usize = 9_000;

#[derive(Clone, Default)]
struct Said(Arc<Mutex<Vec<String>>>);

struct Local {
    said: Said,
}

impl Voice for Local {
    fn rate(&self) -> u32 {
        24_000
    }

    fn say(&mut self, text: &str, sink: &mut dyn Sink) -> Result<(), String> {
        self.said.0.lock().unwrap().push(text.to_string());
        sink.audio(vec![LOCAL_LEVEL; LOCAL_LENGTH]);
        Ok(())
    }
}

fn asked_to_pause(rig: &Rig) -> String {
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    rig.command().id
}

fn reply(rig: &Rig, speech: &str) -> Vec<Event> {
    let id = asked_to_pause(rig);
    rig.done(&id, speech);
    let mut events = Vec::new();
    loop {
        match rig.next() {
            Event::State(state) if state.state == State::Idle => return events,
            event => events.push(event),
        }
    }
}

fn troubles(events: &[Event]) -> Vec<&str> {
    events
        .iter()
        .filter_map(|event| match event {
            Event::Trouble(trouble) => Some(trouble.as_str()),
            _ => None,
        })
        .collect()
}

fn errors(events: &[Event]) -> Vec<&ErrorEvent> {
    events
        .iter()
        .filter_map(|event| match event {
            Event::Error(error) => Some(error),
            _ => None,
        })
        .collect()
}

fn asked(text: &str) -> (String, String, bool) {
    ("loli".into(), text.into(), true)
}

fn kept(rig: &Rig) -> usize {
    std::fs::read_dir(&rig.phrases).map_or(0, |files| files.count())
}

fn wait_until(what: impl Fn() -> bool, within: Duration) -> bool {
    let until = Instant::now() + within;
    while Instant::now() < until {
        if what() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    what()
}

#[test]
fn a_line_is_spoken_from_the_clip_of_the_server() {
    let server = FakeServer::new(Answer::Tone);
    let rig = rig_served(server.clone(), None, "loli", timing());
    let events = reply(&rig, LINE);
    assert!(errors(&events).is_empty(), "{events:?}");
    assert!(troubles(&events).is_empty(), "{events:?}");
    assert_eq!(server.asked(), [asked(LINE)]);
    assert_eq!(rig.heard.voiced(), SERVED);
}

#[test]
fn the_same_line_again_comes_from_the_cache_without_a_request() {
    let server = FakeServer::new(Answer::Tone);
    let rig = rig_served(server.clone(), None, "loli", timing());
    reply(&rig, LINE);
    reply(&rig, LINE);
    assert_eq!(server.asked(), [asked(LINE)]);
    assert_eq!(rig.heard.voiced(), SERVED * 2);
}

#[test]
fn a_line_kept_under_an_older_revision_of_the_server_voice_is_asked_for_again() {
    let server = FakeServer::new(Answer::Tone);
    let rig = rig_served(server.clone(), None, "loli", timing());
    reply(&rig, LINE);
    server.names(Some("2"));
    reply(&rig, OTHER);
    reply(&rig, LINE);
    reply(&rig, LINE);
    assert_eq!(server.asked(), [asked(LINE), asked(OTHER), asked(LINE)]);
}

#[test]
fn a_copy_on_this_computer_is_not_used_while_the_revision_of_the_server_voice_is_unknown() {
    let server = FakeServer::new(Answer::Tone);
    let rig = rig_served(server.clone(), None, "loli", timing());
    reply(&rig, LINE);
    server.names(None);
    reply(&rig, OTHER);
    reply(&rig, LINE);
    assert_eq!(server.asked(), [asked(LINE), asked(OTHER), asked(LINE)]);
}

#[test]
fn a_server_that_names_no_revision_leaves_no_copy_on_this_computer() {
    let server = FakeServer::new(Answer::Tone);
    server.names(None);
    let rig = rig_served(server.clone(), None, "loli", timing());
    reply(&rig, LINE);
    reply(&rig, LINE);
    assert_eq!(server.asked(), [asked(LINE), asked(LINE)]);
    assert_eq!(kept(&rig), 0);
}

#[test]
fn a_failing_server_gives_way_to_the_local_voice_and_tells_why() {
    let said = Said::default();
    let local = Local { said: said.clone() };
    let server = FakeServer::new(Answer::Down(BUSY));
    let rig = rig_served(
        server.clone(),
        Some(Arc::new(Mutex::new(local))),
        "loli",
        timing(),
    );
    let events = reply(&rig, LINE);
    let troubles = troubles(&events);
    assert_eq!(troubles.len(), 1, "{events:?}");
    assert!(troubles[0].contains(BUSY), "{}", troubles[0]);
    assert!(errors(&events).is_empty(), "{events:?}");
    assert_eq!(server.asked(), [asked(LINE)]);
    assert_eq!(*said.0.lock().unwrap(), [LINE]);
    assert_eq!(rig.heard.voiced(), LOCAL_LENGTH);
}

#[test]
fn a_failing_server_without_a_local_voice_fails_the_line() {
    let server = FakeServer::new(Answer::Down(BUSY));
    let rig = rig_served(server.clone(), None, "loli", timing());
    let events = reply(&rig, LINE);
    let errors = errors(&events);
    assert_eq!(errors.len(), 1, "{events:?}");
    assert_eq!(errors[0].code, "tts_failed");
    assert_eq!(errors[0].detail.as_deref(), Some(BUSY));
    assert!(troubles(&events).is_empty(), "{events:?}");
    assert_eq!(rig.heard.voiced(), 0);
}

#[test]
fn a_cancelled_line_stops_being_wanted_by_the_server() {
    let server = FakeServer::new(Answer::Hold);
    let rig = rig_served(server.clone(), None, "loli", timing());
    let id = asked_to_pause(&rig);
    rig.done(&id, LINE);
    assert!(wait_until(
        || !server.asked().is_empty(),
        Duration::from_secs(2)
    ));
    std::thread::sleep(Duration::from_millis(100));
    assert!(!server.let_go.load(Ordering::Relaxed));
    rig.engine.send(Command::Cancel);
    let let_go = || server.let_go.load(Ordering::Relaxed);
    assert!(wait_until(let_go, Duration::from_millis(500)));
}

#[test]
fn a_slow_server_line_is_waited_for_past_the_local_limit() {
    let brief = Timing {
        synth: Duration::from_millis(300),
        ..timing()
    };
    let server = FakeServer::new(Answer::Late(Duration::from_millis(1200)));
    let rig = rig_served(server.clone(), None, "loli", brief);
    let events = reply(&rig, LINE);
    assert!(errors(&events).is_empty(), "{events:?}");
    assert_eq!(rig.heard.voiced(), SERVED);
}

#[test]
fn a_kokoro_voice_is_never_sent_to_the_server() {
    let server = FakeServer::new(Answer::Tone);
    let rig = rig_served(server.clone(), None, "af_heart", timing());
    reply(&rig, "Pausing.");
    assert!(server.asked().is_empty());
}

#[test]
fn with_the_server_voice_on_the_local_voice_model_is_not_required() {
    let store = store(no_models());
    let mut config = Config::default();
    let local = required(&config, &store);
    assert!(local.iter().any(|id| id == "qwen-loli"), "{local:?}");
    config.speak.server = true;
    assert_eq!(
        required(&config, &store),
        hearing(&config).map(String::from)
    );
    config.speak.voice = "af_heart".into();
    assert!(required(&config, &store).iter().any(|id| id == KOKORO));
}
