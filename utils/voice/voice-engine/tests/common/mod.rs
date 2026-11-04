#![allow(dead_code)]

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{Receiver, channel};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use voice_audio::source::{Msg, OpenFn, SourceCtx};
use voice_audio::{Capture, CaptureError, Device, DeviceList, RefTap, Transport};
use voice_engine::{
    Catalog, Clip, Command, Config, Deps, Engine, Event, Output, Source, State, Timing,
};
use voice_models::{Fetch, FetchError, Response, Store};
use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, FixtureCatalog};

pub const CATALOG: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tБаста\t\t3600000\tбасту
artist\tКино\t\t9000000\t
track\tХочу\tЗемфира\t3000000\t
track\tХочу\tМот\t900000\t
track\tЦепи\tСкриптонит\t3000000\t
";

#[derive(Clone, Default)]
pub struct Calls(pub Arc<Mutex<Vec<String>>>);

impl Calls {
    pub fn list(&self) -> Vec<String> {
        self.0.lock().unwrap().clone()
    }

    fn push(&self, call: String) {
        self.0.lock().unwrap().push(call);
    }
}

pub struct FakeOutput {
    pub calls: Calls,
}

impl Output for FakeOutput {
    fn duck(&self, level: f32) {
        self.calls.push(format!("duck {level:.2}"));
    }

    fn reference(&self, on: bool) {
        self.calls.push(format!("reference {on}"));
    }

    fn device(&self) -> Option<String> {
        None
    }

    fn speak(&self, clip: Clip) -> Result<Receiver<()>, String> {
        self.calls
            .push(format!("speak {} at {}", clip.samples.len(), clip.rate));
        let (tx, rx) = channel();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(50));
            let _ = tx.send(());
        });
        Ok(rx)
    }

    fn hush(&self) {
        self.calls.push("hush".into());
    }
}

pub struct Offline;

impl Catalog for Offline {
    fn candidates(&self, _: &[Variant], _: &[Kind]) -> Result<Vec<Entity>, String> {
        Err("offline".into())
    }
}

struct NoFetch;

impl Fetch for NoFetch {
    fn get(&self, _: &str, _: u64) -> Result<Response, FetchError> {
        Err(FetchError::Network("no network in tests".into()))
    }
}

pub fn models_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.cache/store")
}

pub fn store(root: PathBuf) -> Arc<Store> {
    Arc::new(Store::new(root, Arc::new(NoFetch)))
}

pub fn models_ready() -> bool {
    let store = store(models_root());
    let ok = [voice_engine::VAD, voice_engine::ASR_RU]
        .iter()
        .all(|id| matches!(store.status(id), Ok(voice_models::Status::Ready)));
    if !ok {
        eprintln!("models are not in {}, skipped", models_root().display());
    }
    ok
}

pub fn devices() -> DeviceList {
    DeviceList {
        inputs: vec![Device {
            id: "mic".into(),
            name: "Built-in Microphone".into(),
            transport: Transport::Builtin,
            default: true,
            group: None,
        }],
        outputs: Vec::new(),
    }
}

fn wait_stop(ctx: &SourceCtx) {
    while !ctx.stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(5));
    }
}

pub fn feeding(samples: Vec<f32>, rate: u32) -> OpenFn {
    Arc::new(move |ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        let per = rate as usize / 100;
        let mut all = samples.clone();
        all.extend(std::iter::repeat_n(0.0, rate as usize * 2));
        for chunk in all.chunks(per) {
            if ctx.stop.load(Ordering::Relaxed) {
                return;
            }
            let _ = ctx.out.send(Msg::Chunk {
                input: ctx.input,
                samples: chunk.to_vec(),
                rate,
            });
        }
        wait_stop(&ctx);
    })
}

pub fn silent() -> OpenFn {
    Arc::new(|ctx: SourceCtx| {
        let _ = ctx.ready.send(Ok(()));
        while !ctx.stop.load(Ordering::Relaxed) {
            let _ = ctx.out.send(Msg::Chunk {
                input: ctx.input,
                samples: vec![0.0; 160],
                rate: 16_000,
            });
            std::thread::sleep(Duration::from_millis(10));
        }
    })
}

pub fn refusing(error: CaptureError) -> OpenFn {
    Arc::new(move |ctx: SourceCtx| {
        let _ = ctx.ready.send(Err(error.clone()));
    })
}

pub struct Rig {
    pub engine: Engine,
    pub events: Receiver<Event>,
    pub calls: Calls,
}

pub fn timing() -> Timing {
    Timing {
        no_speech: Duration::from_millis(600),
        max_utterance: Duration::from_secs(12),
        ask: Duration::from_millis(400),
        done: Duration::from_millis(600),
        synth: Duration::from_secs(5),
        release: Duration::from_millis(80),
    }
}

pub fn rig_with(open: OpenFn, catalog: Box<dyn Catalog>, root: PathBuf, timing: Timing) -> Rig {
    let calls = Calls::default();
    let deps = Deps {
        capture: Capture::with_source(RefTap::new(), open),
        store: store(root),
        catalog,
        output: Box::new(FakeOutput {
            calls: calls.clone(),
        }),
        devices: devices(),
        timing,
    };
    let (engine, events) = Engine::start(deps);
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.speak.replies = false;
    engine.send(Command::Apply(Box::new(config)));
    engine.send(Command::Star(true));
    Rig {
        engine,
        events,
        calls,
    }
}

pub fn rig() -> Rig {
    rig_with(
        silent(),
        Box::new(FixtureCatalog::from_tsv(CATALOG, true)),
        std::env::temp_dir().join("voice-engine-no-models"),
        timing(),
    )
}

impl Rig {
    pub fn next(&self) -> Event {
        let until = Instant::now() + Duration::from_secs(20);
        loop {
            let left = until.saturating_duration_since(Instant::now());
            match self.events.recv_timeout(left) {
                Ok(Event::Level(_)) | Ok(Event::Partial(_)) => continue,
                Ok(event) => return event,
                Err(_) => panic!("no event in 20 s"),
            }
        }
    }

    pub fn quiet_for(&self, time: Duration) -> Option<Event> {
        let until = Instant::now() + time;
        loop {
            let left = until.saturating_duration_since(Instant::now());
            match self.events.recv_timeout(left) {
                Ok(Event::Level(_)) | Ok(Event::Partial(_)) => continue,
                Ok(event) => return Some(event),
                Err(_) => return None,
            }
        }
    }

    pub fn state(&self) -> (State, Source) {
        match self.next() {
            Event::State(s) => (s.state, s.source),
            other => panic!("expected a state, got {other:?}"),
        }
    }

    pub fn expect_state(&self, state: State) {
        assert_eq!(self.state().0, state);
    }

    pub fn command(&self) -> voice_engine::CommandEvent {
        match self.next() {
            Event::Command(c) => *c,
            other => panic!("expected a command, got {other:?}"),
        }
    }

    pub fn error(&self) -> &'static str {
        match self.next() {
            Event::Error(e) => e.code,
            other => panic!("expected an error, got {other:?}"),
        }
    }

    pub fn text(&self, text: &str) {
        self.engine.send(Command::Text {
            text: text.into(),
            source: Source::Typed,
            id: None,
        });
    }

    pub fn done(&self, id: &str, speech: &str) {
        self.engine.send(Command::Done {
            id: id.into(),
            outcome: voice_engine::Outcome {
                ok: true,
                speech: speech.into(),
                display: speech.into(),
                undo: false,
            },
        });
    }
}
