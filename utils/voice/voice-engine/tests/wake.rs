mod common;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use common::{
    CATALOG, Clips, Rig, devices, in_real_time, models_ready, models_root, refusing, rig_with,
    silent, timing,
};
use voice_audio::source::OpenFn;
use voice_audio::{CaptureError, ErrorCode};
use voice_engine::{Command, Config, Event, Language, Source, State};
use voice_resolve::FixtureCatalog;

const RATE: usize = 16_000;
const HEARD_WITHIN: Duration = Duration::from_secs(3);
const ARMED_WITHIN: Duration = Duration::from_secs(5);

struct Row {
    file: String,
    language: Language,
    voice: String,
    named: bool,
}

struct Woke {
    phrase: String,
    command: Option<String>,
}

fn listening_for_the_name(open: OpenFn, language: Language, voice: &str) -> Rig {
    let catalog = Arc::new(FixtureCatalog::from_tsv(CATALOG, true));
    let rig = rig_with(open, catalog, models_root(), timing());
    let mut config = Config {
        enabled: true,
        language,
        ..Config::default()
    };
    config.speak.replies = false;
    config.speak.voice = voice.into();
    config.activation.wake.on = true;
    rig.engine.send(Command::Apply(Box::new(config)));
    rig
}

fn microphone_taken(rig: &Rig) -> usize {
    let calls = rig.calls.list();
    calls
        .iter()
        .filter(|call| *call == "reference true")
        .count()
}

fn wait_for_microphone(rig: &Rig, times: usize) {
    let until = Instant::now() + ARMED_WITHIN;
    while microphone_taken(rig) < times {
        assert!(Instant::now() < until, "{:?}", rig.calls.list());
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn hear(rig: &Rig, clips: &Clips, said: &[f32]) -> Option<Woke> {
    let mut samples = room(RATE / 4);
    samples.extend_from_slice(said);
    samples.extend(room(RATE * 2));
    let long = Duration::from_millis((samples.len() * 1000 / RATE) as u64) + HEARD_WITHIN;
    clips.lock().unwrap().push_back(samples);
    rig.engine.send(Command::Devices(devices()));
    let until = Instant::now() + long;
    let mut woke: Option<Woke> = None;
    loop {
        let left = until.saturating_duration_since(Instant::now());
        match rig.quiet_for(left) {
            Some(Event::Wake(wake)) => {
                woke = Some(Woke {
                    phrase: wake.phrase,
                    command: None,
                })
            }
            Some(Event::Command(command)) => {
                rig.done(&command.id, "");
                if let Some(woke) = woke.as_mut() {
                    woke.command = Some(command.heard);
                }
            }
            Some(Event::State(state)) if state.state == State::Idle && woke.is_some() => {
                return woke;
            }
            Some(_) => {}
            None => return woke,
        }
    }
}

fn room(samples: usize) -> Vec<f32> {
    let mut seed = 1u32;
    let hiss = |_| {
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        ((seed >> 16) as f32 / 32_768.0 - 1.0) * 0.0005
    };
    (0..samples).map(hiss).collect()
}

fn wait_for_call(rig: &Rig, call: &str) {
    let until = Instant::now() + ARMED_WITHIN;
    while rig.calls.list().last().map(String::as_str) != Some(call) {
        assert!(Instant::now() < until, "{:?}", rig.calls.list());
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn clip(path: &Path) -> Vec<f32> {
    let (samples, rate) = voice_speech::read_mono(path).unwrap();
    voice_speech::to_16k(&samples, rate).unwrap()
}

fn rows(folder: &Path) -> Vec<Row> {
    let list = std::fs::read_to_string(folder.join("list.tsv")).unwrap();
    let row = |line: &str| {
        let cells: Vec<&str> = line.split('\t').collect();
        Row {
            file: cells[0].into(),
            language: if cells[1] == "en" {
                Language::En
            } else {
                Language::Ru
            },
            voice: cells[2].into(),
            named: cells[3] == "named",
        }
    };
    list.lines()
        .filter(|line| !line.is_empty())
        .map(row)
        .collect()
}

#[test]
fn the_idle_engine_keeps_the_microphone_for_its_name_and_lends_it_to_a_press() {
    if !models_ready() {
        return;
    }
    let rig = listening_for_the_name(silent(), Language::Ru, "loli");
    wait_for_microphone(&rig, 1);
    rig.engine.send(Command::Start(Source::Button));
    loop {
        if let Event::State(state) = rig.next()
            && state.state == State::Listening
        {
            assert_eq!(state.source, Source::Button);
            break;
        }
    }
    rig.expect_state(State::Idle);
    wait_for_microphone(&rig, 3);
}

#[test]
fn with_the_setting_off_the_microphone_stays_closed() {
    if !models_ready() {
        return;
    }
    let rig = listening_for_the_name(silent(), Language::Ru, "loli");
    wait_for_microphone(&rig, 1);
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    wait_for_call(&rig, "reference false");
    assert!(rig.quiet_for(Duration::from_millis(400)).is_none());
    assert_eq!(microphone_taken(&rig), 1);
}

#[test]
fn the_engine_lets_go_of_the_microphone_when_the_app_quits() {
    if !models_ready() {
        return;
    }
    let rig = listening_for_the_name(silent(), Language::Ru, "loli");
    wait_for_microphone(&rig, 1);
    assert!(rig.engine.quit(ARMED_WITHIN));
    assert!(!rig.engine.quit(ARMED_WITHIN));
}

#[test]
fn a_refused_microphone_is_told_once_until_the_settings_change() {
    if !models_ready() {
        return;
    }
    let denied = CaptureError::new(ErrorCode::MicDenied, "access denied");
    let rig = listening_for_the_name(refusing(denied), Language::Ru, "loli");
    assert_eq!(rig.error(), "mic_denied");
    rig.engine.send(Command::Devices(devices()));
    assert!(rig.quiet_for(Duration::from_millis(400)).is_none());
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.speak.replies = false;
    config.speak.voice = "moriarty".into();
    config.activation.wake.on = true;
    rig.engine.send(Command::Apply(Box::new(config)));
    assert_eq!(rig.error(), "mic_denied");
}

#[test]
fn recorded_phrases_wake_the_engine_only_by_name() {
    let Some(folder) = std::env::var_os("VOICE_WAKE_SET").map(PathBuf::from) else {
        return;
    };
    assert!(models_ready(), "the wake set needs the models");
    let mut missed = Vec::new();
    let mut mistaken = Vec::new();
    let rows = rows(&folder);
    let mut rigs: Vec<(Language, String, Clips, Rig)> = Vec::new();
    for row in &rows {
        let known =
            |rig: &(Language, String, Clips, Rig)| rig.0 == row.language && rig.1 == row.voice;
        if !rigs.iter().any(known) {
            let clips = Clips::default();
            let rig = listening_for_the_name(in_real_time(clips.clone()), row.language, &row.voice);
            wait_for_microphone(&rig, 1);
            rigs.push((row.language, row.voice.clone(), clips, rig));
        }
        let (_, _, clips, rig) = rigs.iter().find(|rig| known(rig)).unwrap();
        let woke = hear(rig, clips, &clip(&folder.join(&row.file)));
        let told = match &woke {
            Some(woke) => format!("woke on {:?}, command {:?}", woke.phrase, woke.command),
            None => "quiet".into(),
        };
        println!("{}\t{}\t{told}", row.file, row.voice);
        match (row.named, woke) {
            (true, None) => missed.push(row.file.clone()),
            (false, Some(_)) => mistaken.push(row.file.clone()),
            _ => {}
        }
    }
    let named = rows.iter().filter(|row| row.named).count();
    println!(
        "wake set: {named} named, missed {}; {} others, woke by mistake {}",
        missed.len(),
        rows.len() - named,
        mistaken.len()
    );
    assert!(mistaken.is_empty(), "{mistaken:?}");
}
