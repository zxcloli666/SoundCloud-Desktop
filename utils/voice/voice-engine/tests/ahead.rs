mod common;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use common::{Rig, rig_speaking_on, timing};
use voice_engine::{
    Ahead, Catalog, Chat, Command, CommandEvent, Config, Event, HeardEvent, Sink, Source, State,
    Timed, Voice,
};
use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, FixtureCatalog};

const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
track\tКак дела\tT-Fest\t3000000\t
track\tКак дела\tKIZARU\t2800000\t
";
const BUDGET: Duration = Duration::from_millis(500);
const QUICK: Duration = Duration::from_millis(200);
const SLOW: Duration = Duration::from_millis(1100);
const REPLY: [&str; 2] = ["Привет! Как де", "ла у тебя?"];
const SPOKEN: [&str; 2] = ["Привет!", "Как дела у тебя?"];

struct Waiting {
    rows: FixtureCatalog,
    wait: Duration,
}

impl Catalog for Waiting {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String> {
        std::thread::sleep(self.wait);
        Ok(voice_resolve::Catalog::candidates(
            &self.rows, variants, kinds,
        ))
    }
}

#[derive(Clone, Default)]
struct Said(Arc<Mutex<Vec<String>>>);

impl Said {
    fn list(&self) -> Vec<String> {
        self.0.lock().unwrap().clone()
    }
}

impl Voice for Said {
    fn rate(&self) -> u32 {
        24000
    }

    fn say(&mut self, text: &str, sink: &mut dyn Sink) -> Result<(), String> {
        self.0.lock().unwrap().push(text.to_string());
        sink.audio(vec![0.5; 2400]);
        Ok(())
    }
}

struct Heard {
    events: Vec<Event>,
    command: CommandEvent,
    took: Duration,
}

impl Heard {
    fn announced(&self) -> Option<&HeardEvent> {
        self.events.iter().find_map(|event| match event {
            Event::Heard(heard) => Some(heard),
            _ => None,
        })
    }

    fn timed(&self) -> &Timed {
        let timed = self.events.iter().find_map(|event| match event {
            Event::Timed(timed) => Some(timed),
            _ => None,
        });
        timed.expect("a timing line")
    }

    fn cancelled(&self) -> Vec<&str> {
        let ids = self.events.iter().filter_map(|event| match event {
            Event::Cancelled(turn) => Some(turn.id.as_str()),
            _ => None,
        });
        ids.collect()
    }
}

fn rig(wait: Duration, chat: bool) -> (Rig, Said) {
    let said = Said::default();
    let catalog = Waiting {
        rows: FixtureCatalog::from_tsv(ROWS, true),
        wait,
    };
    let mut timing = timing();
    timing.lookup = BUDGET;
    let rig = rig_speaking_on(said.clone(), Arc::new(catalog), timing);
    let config = Config {
        enabled: true,
        llm: chat,
        ..Config::default()
    };
    rig.engine.send(Command::Apply(Box::new(config)));
    (rig, said)
}

fn say(rig: &Rig, text: &str, source: Source) {
    rig.engine.send(Command::Text {
        text: text.into(),
        source,
        id: None,
    });
}

fn raw(rig: &Rig) -> Event {
    let event = rig.events.recv_timeout(Duration::from_secs(20));
    event.expect("an event")
}

fn announced(rig: &Rig, text: &str) -> HeardEvent {
    say(rig, text, Source::Button);
    rig.expect_state(State::Thinking);
    match raw(rig) {
        Event::Heard(heard) => heard,
        other => panic!("expected the phrase, got {other:?}"),
    }
}

fn verdict(rig: &Rig, asked: Instant) -> Heard {
    let mut events = Vec::new();
    loop {
        match raw(rig) {
            Event::Command(command) => {
                return Heard {
                    events,
                    command: *command,
                    took: asked.elapsed(),
                };
            }
            event => events.push(event),
        }
    }
}

fn heard(rig: &Rig, text: &str, source: Source) -> Heard {
    let asked = Instant::now();
    say(rig, text, source);
    verdict(rig, asked)
}

fn stream(rig: &Rig, id: &str) {
    rig.chat(id, Chat::Open { speak: true });
    for piece in REPLY {
        rig.chat(id, Chat::Text(piece.to_string()));
    }
    rig.chat(id, Chat::Close);
}

#[test]
fn a_phrase_that_may_be_talk_is_announced_before_its_lookups_answer() {
    let (rig, _) = rig(SLOW, true);
    let asked = Instant::now();
    let phrase = announced(&rig, "как дела");
    assert!(asked.elapsed() < QUICK, "{:?}", asked.elapsed());
    assert_eq!(
        (phrase.heard.as_str(), phrase.source),
        ("как дела", Source::Button)
    );
    let heard = verdict(&rig, asked);
    assert!(
        heard.took >= BUDGET && heard.took < SLOW,
        "{:?}",
        heard.took
    );
    assert_eq!(heard.command.intent, "none");
    assert_eq!(heard.command.id, phrase.id);
    assert_eq!(heard.command.heard, phrase.heard);
}

#[test]
fn a_chat_started_ahead_is_held_and_then_spoken_when_the_phrase_is_talk() {
    let (rig, said) = rig(QUICK, true);
    let asked = Instant::now();
    let phrase = announced(&rig, "как дела");
    stream(&rig, &phrase.id);
    assert_eq!(rig.quiet_for(QUICK / 2), None);
    assert!(said.list().is_empty());
    let heard = verdict(&rig, asked);
    assert_eq!(heard.command.id, phrase.id);
    assert_eq!(heard.command.candidates.len(), 2);
    assert!(heard.cancelled().is_empty());
    let Some(Ahead {
        chat: Some(ahead),
        kept: true,
    }) = heard.timed().ahead
    else {
        panic!("expected a kept chat, got {:?}", heard.timed().ahead);
    };
    assert!(ahead >= QUICK / 2 && ahead <= heard.took, "{ahead:?}");
    rig.expect_state(State::Speaking);
    rig.done(&phrase.id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), SPOKEN);
}

#[test]
fn a_chat_started_ahead_is_cancelled_unheard_when_the_phrase_is_an_action() {
    let (rig, said) = rig(QUICK, true);
    let asked = Instant::now();
    let phrase = announced(&rig, "скриптонит");
    stream(&rig, &phrase.id);
    let heard = verdict(&rig, asked);
    assert_eq!(heard.command.intent, "play");
    assert_ne!(heard.command.id, phrase.id);
    assert_eq!(heard.cancelled(), [phrase.id.as_str()]);
    let Some(Ahead {
        chat: Some(_),
        kept: false,
    }) = heard.timed().ahead
    else {
        panic!("expected a dropped chat, got {:?}", heard.timed().ahead);
    };
    rig.chat(&phrase.id, Chat::Text("Поздно.".into()));
    rig.done(&heard.command.id, "");
    rig.expect_state(State::Idle);
    assert_eq!(rig.quiet_for(QUICK), None);
    assert!(said.list().is_empty());
}

#[test]
fn a_chat_that_was_not_started_ahead_starts_after_the_verdict_as_before() {
    let (rig, said) = rig(QUICK, true);
    let talk = heard(&rig, "как дела", Source::Button);
    let phrase = talk.announced().expect("the phrase");
    assert_eq!(talk.command.id, phrase.id);
    let waited = Ahead {
        chat: None,
        kept: true,
    };
    assert_eq!(talk.timed().ahead, Some(waited));
    assert!(talk.cancelled().is_empty());
    stream(&rig, &phrase.id);
    rig.expect_state(State::Speaking);
    rig.done(&phrase.id, "");
    rig.expect_state(State::Idle);
    assert_eq!(said.list(), SPOKEN);

    let action = heard(&rig, "скриптонит", Source::Button);
    let dropped = action.announced().expect("the phrase").id.clone();
    assert!(action.cancelled().is_empty());
    rig.chat(&dropped, Chat::Open { speak: true });
    assert_eq!(rig.cancelled(), dropped);
}

#[test]
fn cancelling_during_the_lookups_drops_the_chat_started_ahead() {
    let (rig, said) = rig(SLOW, true);
    let phrase = announced(&rig, "как дела");
    stream(&rig, &phrase.id);
    rig.engine.send(Command::Cancel);
    assert_eq!(rig.cancelled(), phrase.id);
    rig.expect_state(State::Idle);
    assert_eq!(rig.quiet_for(SLOW), None);
    assert!(said.list().is_empty());
}

#[test]
fn a_new_phrase_drops_the_chat_started_ahead_of_the_one_before() {
    let (rig, said) = rig(SLOW, true);
    let first = announced(&rig, "как дела");
    stream(&rig, &first.id);
    say(&rig, "пауза", Source::Button);
    assert_eq!(rig.cancelled(), first.id);
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "pause");
    rig.done(&command.id, "");
    rig.expect_state(State::Idle);
    assert!(said.list().is_empty());
}

#[test]
fn nothing_is_announced_when_the_phrase_cannot_end_in_the_chat_or_has_nothing_to_wait_for() {
    let (off, _) = rig(QUICK, false);
    assert_eq!(heard(&off, "скриптонит", Source::Button).announced(), None);

    let (on, _) = rig(QUICK, true);
    let verb = heard(&on, "включи скриптонита", Source::Button);
    assert_eq!((verb.announced(), verb.timed().ahead), (None, None));
    on.done(&verb.command.id, "");
    on.expect_state(State::Idle);

    let plain = heard(&on, "привет", Source::Button);
    assert_eq!((plain.command.intent, plain.announced()), ("none", None));
    on.done(&plain.command.id, "");
    on.expect_state(State::Idle);

    let remote = heard(&on, "как дела", Source::Remote);
    assert_eq!((remote.command.intent, remote.announced()), ("none", None));
    on.done(&remote.command.id, "");
    on.expect_state(State::Idle);

    let remembered = heard(&on, "как дела", Source::Button);
    assert_eq!(remembered.announced(), None);
    assert_eq!(remembered.command.candidates.len(), 2);
    assert!(remembered.took < QUICK, "{:?}", remembered.took);
}
