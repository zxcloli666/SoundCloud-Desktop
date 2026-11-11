mod common;

use std::path::PathBuf;
use std::time::Duration;

use common::{feeding, models_ready, models_root, rig_with, timing};
use voice_engine::{ASR_EN, Command, Config, DecisionEvent, Echo, Event, Language, Source, State};
use voice_resolve::FixtureCatalog;

fn clip(path: &str) -> Option<(Vec<f32>, u32)> {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../.cache")
        .join(path);
    if !path.exists() {
        eprintln!("{} is missing, skipped", path.display());
        return None;
    }
    Some(voice_speech::read_mono(&path).unwrap())
}

fn hear(path: &str, language: Language) -> Option<(Vec<String>, voice_engine::CommandEvent)> {
    if !models_ready() {
        return None;
    }
    let store = common::store(models_root());
    if !matches!(store.status(ASR_EN), Ok(voice_models::Status::Ready)) && language == Language::En
    {
        eprintln!("english model is missing, skipped");
        return None;
    }
    let (samples, rate) = clip(path)?;
    let mut slow = timing();
    slow.no_speech = Duration::from_secs(10);
    let rig = rig_with(
        feeding(samples, rate),
        Box::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        slow,
    );
    let config = Config {
        enabled: true,
        language,
        echo: Echo::On,
        ..Config::default()
    };
    rig.engine.send(Command::Apply(Box::new(config)));
    rig.engine.send(Command::Start(Source::Button));
    let mut partials = Vec::new();
    loop {
        match rig
            .events
            .recv_timeout(Duration::from_secs(20))
            .expect("event")
        {
            Event::Partial(p) => partials.push(p.text),
            Event::Command(command) => return Some((partials, *command)),
            Event::State(s) => assert_ne!(s.state, State::Idle, "went idle without a command"),
            Event::Error(e) => panic!("error {e:?}"),
            Event::Level(_) | Event::Cancelled(_) | Event::Trouble(_) => {}
        }
    }
}

#[test]
fn spoken_play_command_from_a_wav_reaches_a_command_event() {
    let Some((partials, command)) = hear("hot/p1.wav", Language::Ru) else {
        return;
    };
    assert!(!partials.is_empty());
    assert_eq!(command.source, Source::Button);
    assert_eq!(command.intent, "play", "heard {:?}", command.heard);
    let Some(DecisionEvent::Act { pick }) = command.decision else {
        panic!("expected act for {:?}", command.heard);
    };
    assert_eq!(pick.entity.name, "Скриптонит");
}

#[test]
fn loli_saying_stop_is_a_stop_command() {
    let Some((_, command)) = hear("audio/100.wav", Language::Ru) else {
        return;
    };
    assert_eq!(command.intent, "stop", "heard {:?}", command.heard);
}

#[test]
fn english_speech_goes_through_the_batch_model() {
    let Some((partials, command)) = hear("audio/0.wav", Language::En) else {
        return;
    };
    assert!(partials.is_empty());
    assert!(
        command.heard.to_lowercase().contains("what your country"),
        "heard {:?}",
        command.heard
    );
}

#[test]
fn a_reply_is_spoken_with_kokoro_and_drives_speech_levels() {
    if !models_ready() {
        return;
    }
    let store = common::store(models_root());
    if !matches!(
        store.status(voice_engine::KOKORO),
        Ok(voice_models::Status::Ready)
    ) {
        eprintln!("kokoro is missing, skipped");
        return;
    }
    let Some((samples, rate)) = clip("audio/100.wav") else {
        return;
    };
    let mut slow = timing();
    slow.no_speech = Duration::from_secs(10);
    slow.synth = Duration::from_secs(60);
    let rig = rig_with(
        feeding(samples, rate),
        Box::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        models_root(),
        slow,
    );
    let mut config = Config {
        enabled: true,
        echo: Echo::On,
        ..Config::default()
    };
    config.speak.voice = "af_heart".into();
    rig.engine.send(Command::Apply(Box::new(config)));
    rig.engine.send(Command::Start(Source::Hotkey));
    rig.engine.send(Command::Release(Source::Hotkey));
    let command = loop {
        match rig
            .events
            .recv_timeout(Duration::from_secs(20))
            .expect("event")
        {
            Event::Command(command) => break *command,
            Event::Error(e) => panic!("error {e:?}"),
            _ => {}
        }
    };
    rig.done(&command.id, "Остановила");
    let mut speaking = false;
    let mut levels = 0;
    loop {
        match rig
            .events
            .recv_timeout(Duration::from_secs(60))
            .expect("event")
        {
            Event::State(s) if s.state == State::Speaking => speaking = true,
            Event::State(s) if s.state == State::Idle => break,
            Event::Level(l) if l.input == "speech" => levels += 1,
            Event::Error(e) => panic!("error {e:?}"),
            _ => {}
        }
    }
    assert!(speaking);
    assert!(levels > 0);
    let spoke = rig
        .calls
        .list()
        .into_iter()
        .find(|c| c.starts_with("speak"))
        .unwrap();
    assert!(spoke.ends_with("at 24000"), "{spoke}");
}
