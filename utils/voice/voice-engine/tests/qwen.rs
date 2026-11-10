mod common;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use common::{Rig, rig_on, silent, timing};
use voice_engine::{Command, Config, Source, State};
use voice_models::{Fetch, FetchError, File, Kind, Manifest, Model, Options, Response, Store};
use voice_resolve::FixtureCatalog;

struct NoFetch;

impl Fetch for NoFetch {
    fn get(&self, _: &str, _: u64) -> Result<Response, FetchError> {
        Err(FetchError::Network("no network in tests".into()))
    }
}

fn model(root: &Path, id: &str, kind: Kind, name: &str, from: &Path) -> Model {
    let dir = root.join(id).join("1");
    std::fs::create_dir_all(&dir).unwrap();
    std::os::unix::fs::symlink(from, dir.join(name)).unwrap();
    let size = std::fs::metadata(from).unwrap().len();
    Model {
        id: id.into(),
        version: "1".into(),
        kind,
        language: "any".into(),
        license: "own".into(),
        unpacked_size: size,
        platform: None,
        requires: vec![],
        files: vec![File {
            path: name.into(),
            url: String::new(),
            size,
            sha256: "0".repeat(64),
            executable: kind == Kind::Engine,
        }],
    }
}

fn voice_store() -> Option<Arc<Store>> {
    let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let (program, talker, codec) = (
        path("SCD_QWEN")?,
        path("SCD_QWEN_TALKER")?,
        path("SCD_QWEN_CODEC")?,
    );
    let root = std::env::temp_dir().join(format!("voice-engine-qwen-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let models = vec![
        model(&root, "qwen-engine-test", Kind::Engine, "scd-qwen", &program),
        model(&root, "qwen-codec", Kind::Tts, "qwen-tokenizer-12hz-Q8_0.gguf", &codec),
        model(
            &root,
            "qwen-lolya",
            Kind::Tts,
            "qwen-talker-1.7b-lolya-Q4_K_M.gguf",
            &talker,
        ),
    ];
    let manifest = Manifest::from_models(models).unwrap();
    Some(Arc::new(Store::with_manifest(
        root,
        manifest,
        Arc::new(NoFetch),
        Options::default(),
    )))
}

fn speaking_rig(voice: &str) -> Option<Rig> {
    let Some(store) = voice_store() else {
        eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
        return None;
    };
    let mut patient = timing();
    patient.synth = Duration::from_secs(90);
    let rig = rig_on(
        silent(),
        Box::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        store,
        patient,
    );
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.speak.voice = voice.into();
    rig.engine.send(Command::Apply(Box::new(config)));
    Some(rig)
}

fn reply(rig: &Rig, speech: &str) -> (Duration, usize) {
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    let asked = Instant::now();
    rig.done(&command.id, speech);
    rig.expect_state(State::Speaking);
    let lead = asked.elapsed();
    rig.expect_state(State::Idle);
    let spoken = rig
        .calls
        .list()
        .iter()
        .rev()
        .find_map(|call| {
            let count = call.strip_prefix("speak ")?.strip_suffix(" at 24000")?;
            count.parse::<usize>().ok()
        })
        .expect("spoken at 24 kHz");
    (lead, spoken)
}

#[test]
fn a_reply_streams_from_the_qwen_voice_and_repeats_from_the_cache() {
    let Some(rig) = speaking_rig("lolya") else {
        return;
    };
    let (first, played) = reply(&rig, "Ставлю на паузу, а потом продолжу с того же места.");
    let (again, exact) = reply(&rig, "Ставлю на паузу, а потом продолжу с того же места.");
    let seconds = exact as f32 / 24000.0;
    let gaps = (played as f32 - exact as f32) / 24000.0;
    eprintln!("first reply: sound after {first:?}, {seconds:.2} s long, {gaps:.2} s of gaps");
    eprintln!("same reply again: sound after {again:?}");
    assert!((1.5..12.0).contains(&seconds), "{seconds}");
    assert!((-0.05..0.3).contains(&gaps), "{gaps}");
    assert!(again < Duration::from_millis(300), "{again:?}");
}

#[test]
fn the_robot_speaks_with_the_same_engine() {
    let Some(rig) = speaking_rig("robot") else {
        return;
    };
    let (_, samples) = reply(&rig, "Готово.");
    assert!(samples > 12000, "{samples}");
}
