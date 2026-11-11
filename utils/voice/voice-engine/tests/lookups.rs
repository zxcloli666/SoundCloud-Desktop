mod common;

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use common::{Rig, rig_with, silent, timing};
use voice_engine::{Catalog, Command, CommandEvent, Config, Event, Looked, State, Timed};
use voice_nlu::{Kind, Names, Variant};
use voice_resolve::{Entity, FixtureCatalog, Phrase};

const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tMichael Jackson\t\t40000000\tмайкл джексон
track\tКак дела\tT-Fest\t3000000\t
track\tКак дела\tKIZARU\t2800000\t
";
const BUDGET: Duration = Duration::from_millis(300);
const QUICK: Duration = Duration::from_millis(40);
const SLOW: Duration = Duration::from_millis(900);

#[derive(Default)]
struct Seen {
    running: AtomicUsize,
    most: AtomicUsize,
    finished: AtomicUsize,
}

struct Slow {
    rows: FixtureCatalog,
    wait: Duration,
    seen: Arc<Seen>,
}

impl Catalog for Slow {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String> {
        let running = self.seen.running.fetch_add(1, Ordering::SeqCst) + 1;
        self.seen.most.fetch_max(running, Ordering::SeqCst);
        std::thread::sleep(self.wait);
        self.seen.running.fetch_sub(1, Ordering::SeqCst);
        self.seen.finished.fetch_add(1, Ordering::SeqCst);
        Ok(voice_resolve::Catalog::candidates(
            &self.rows, variants, kinds,
        ))
    }
}

fn rig(wait: Duration, chat: bool, names: &[&str]) -> (Rig, Arc<Seen>) {
    let seen = Arc::new(Seen::default());
    let catalog = Slow {
        rows: FixtureCatalog::from_tsv(ROWS, true),
        wait,
        seen: seen.clone(),
    };
    let mut timing = timing();
    timing.lookup = BUDGET;
    let rig = rig_with(
        silent(),
        Arc::new(catalog),
        std::env::temp_dir().join("voice-engine-no-models"),
        timing,
    );
    let mut config = Config {
        enabled: true,
        llm: chat,
        names: names.iter().map(|name| name.to_string()).collect(),
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    (rig, seen)
}

fn heard(rig: &Rig, text: &str) -> (Timed, CommandEvent, Duration) {
    let asked = Instant::now();
    rig.text(text);
    let mut timed = None;
    loop {
        match rig.events.recv_timeout(Duration::from_secs(20)) {
            Ok(Event::Timed(line)) => timed = Some(line),
            Ok(Event::Command(command)) => {
                let took = asked.elapsed();
                rig.done(&command.id, "");
                rig.expect_state(State::Idle);
                return (timed.expect("a timing line"), *command, took);
            }
            Ok(Event::State(_) | Event::Heard(_)) => {}
            other => panic!("expected a command, got {other:?}"),
        }
    }
}

fn planned(text: &str, names: &[&str]) -> usize {
    Phrase::read(text, &Names::new(names)).lookups().len()
}

#[test]
fn the_lookups_of_one_phrase_run_at_the_same_time() {
    let names = ["Michael"];
    let text = "michael jackson";
    let lookups = planned(text, &names);
    assert!(lookups >= 2, "{lookups}");
    let (rig, seen) = rig(Duration::from_millis(250), false, &names);
    let (timed, command, _) = heard(&rig, text);
    assert_eq!(command.intent, "play");
    assert_eq!(timed.lookups.len(), lookups);
    assert_eq!(seen.most.load(Ordering::SeqCst), lookups);
}

#[test]
fn with_the_chat_on_a_phrase_without_a_verb_goes_out_when_the_budget_is_over() {
    let (rig, seen) = rig(SLOW, true, &[]);
    let (timed, command, took) = heard(&rig, "как дела");
    assert_eq!(command.intent, "none");
    assert_eq!(command.decision, None);
    assert!(command.candidates.is_empty());
    assert_eq!(timed.lookups, [Looked::Late]);
    assert!(took >= BUDGET && took < SLOW, "{took:?}");

    let until = Instant::now() + Duration::from_secs(10);
    while seen.finished.load(Ordering::SeqCst) == 0 && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(seen.finished.load(Ordering::SeqCst), 1);
    assert_eq!(rig.quiet_for(Duration::from_millis(200)), None);
}

#[test]
fn a_lookup_that_is_in_time_gives_the_phrase_its_hits() {
    let (rig, _) = rig(QUICK, true, &[]);
    let (timed, command, _) = heard(&rig, "как дела");
    assert_eq!(command.intent, "none");
    assert_eq!(command.candidates.len(), 2);
    assert!(matches!(timed.lookups[..], [Looked::In(took)] if took >= QUICK));
    assert!(timed.total >= QUICK && timed.read < timed.total);
}

#[test]
fn a_phrase_with_a_verb_waits_for_its_lookup_past_the_budget() {
    let (rig, _) = rig(SLOW, true, &[]);
    let (timed, command, took) = heard(&rig, "включи скриптонита");
    assert_eq!(command.intent, "play");
    assert!(command.decision.is_some());
    assert!(took >= SLOW, "{took:?}");
    assert!(matches!(timed.lookups[..], [Looked::In(took)] if took >= SLOW));
}

#[test]
fn with_the_chat_off_a_phrase_without_a_verb_waits_for_its_lookup() {
    let (rig, _) = rig(SLOW, false, &[]);
    let (_, command, took) = heard(&rig, "скриптонит");
    assert_eq!(command.intent, "play");
    assert!(took >= SLOW, "{took:?}");
}

#[test]
fn a_phrase_that_needs_no_lookup_is_timed_too() {
    let (rig, seen) = rig(SLOW, true, &["Лоля"]);
    let (timed, command, took) = heard(&rig, "привет, лоля");
    assert_eq!(command.intent, "none");
    assert!(timed.lookups.is_empty());
    assert!(took < BUDGET, "{took:?}");
    assert_eq!(seen.most.load(Ordering::SeqCst), 0);
}

fn finished(seen: &Seen, lookups: usize) {
    let until = Instant::now() + Duration::from_secs(10);
    while seen.finished.load(Ordering::SeqCst) < lookups && Instant::now() < until {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(seen.finished.load(Ordering::SeqCst), lookups);
}

#[test]
fn a_phrase_cancelled_while_it_is_looked_up_does_nothing() {
    let (rig, seen) = rig(SLOW, true, &[]);
    let asked = Instant::now();
    rig.text("включи скриптонита");
    rig.expect_state(State::Thinking);
    std::thread::sleep(QUICK);
    rig.engine.send(Command::Cancel);
    rig.expect_state(State::Idle);
    assert!(asked.elapsed() < SLOW, "{:?}", asked.elapsed());
    finished(&seen, 1);
    assert_eq!(rig.quiet_for(Duration::from_millis(200)), None);
}

#[test]
fn a_new_phrase_replaces_one_that_is_still_looked_up() {
    let (rig, seen) = rig(SLOW, true, &[]);
    rig.text("включи скриптонита");
    rig.expect_state(State::Thinking);
    std::thread::sleep(QUICK);
    rig.text("пауза");
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "pause");
    rig.done(&command.id, "");
    rig.expect_state(State::Idle);
    finished(&seen, 1);
    assert_eq!(rig.quiet_for(Duration::from_millis(200)), None);
}

#[test]
fn a_late_lookup_is_remembered_for_the_phrase_said_again() {
    let (rig, seen) = rig(SLOW, true, &[]);
    let (timed, late, _) = heard(&rig, "как дела");
    assert_eq!(timed.lookups, [Looked::Late]);
    assert!(late.candidates.is_empty());
    for asked in Phrase::read("как дела", &Names::default()).lookups() {
        rig.engine
            .candidates(&asked.variants, &asked.kinds)
            .0
            .unwrap();
    }
    let (timed, again, took) = heard(&rig, "как дела");
    assert_eq!(timed.lookups, [Looked::Remembered]);
    assert_eq!(again.candidates.len(), 2);
    assert!(took < BUDGET, "{took:?}");
    assert_eq!(seen.finished.load(Ordering::SeqCst), 1);
}

#[test]
fn a_search_for_the_name_a_phrase_looked_up_is_answered_from_memory() {
    let (rig, seen) = rig(QUICK, true, &[]);
    let said = heard(&rig, "скриптонит").1;
    assert_eq!(said.intent, "play");
    let named = voice_resolve::named("Скриптонит");
    let variants: Vec<Variant> = named.iter().flat_map(|n| n.queries.clone()).collect();
    let kinds = [Kind::Track, Kind::Artist, Kind::Album, Kind::Playlist];
    let (found, looked) = rig.engine.candidates(&variants, &kinds);
    assert_eq!(looked, Looked::Remembered);
    assert!(found.unwrap().iter().any(|hit| hit.name == "Скриптонит"));
    assert_eq!(seen.finished.load(Ordering::SeqCst), 1);

    let (found, looked) = rig.engine.candidates(&variants, &[Kind::Artist]);
    assert_eq!(looked, Looked::Remembered);
    let found: Vec<String> = found.unwrap().into_iter().map(|hit| hit.name).collect();
    assert_eq!(found, ["Скриптонит"]);
    assert_eq!(seen.finished.load(Ordering::SeqCst), 1);

    let other = voice_resolve::named("Michael Jackson");
    let variants: Vec<Variant> = other.iter().flat_map(|n| n.queries.clone()).collect();
    let (found, looked) = rig.engine.candidates(&variants, &[Kind::Artist]);
    assert!(matches!(looked, Looked::In(took) if took >= QUICK));
    assert_eq!(found.unwrap().len(), 1);
    assert_eq!(seen.finished.load(Ordering::SeqCst), 2);
}

#[test]
fn a_search_made_while_the_same_lookup_runs_waits_for_it() {
    let (rig, seen) = rig(SLOW, true, &[]);
    let asked = Phrase::read("как дела", &Names::default()).lookups();
    rig.text("как дела");
    rig.expect_state(State::Thinking);
    std::thread::sleep(QUICK);
    let (found, looked) = rig.engine.candidates(&asked[0].variants, &asked[0].kinds);
    assert_eq!(found.unwrap().len(), 2);
    assert!(matches!(looked, Looked::In(took) if took < SLOW));
    assert_eq!(seen.most.load(Ordering::SeqCst), 1);
    assert_eq!(seen.finished.load(Ordering::SeqCst), 1);
}
