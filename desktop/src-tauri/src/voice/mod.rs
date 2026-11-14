mod api;
mod catalog;
mod chat;
pub mod commands;
mod devices;
mod events;
mod fetch;
mod models;
mod output;
mod previews;
mod resolve;
mod server;

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;
use tokio::runtime::Handle;
use voice_audio::{Capture, DeviceList, RefTap};
use voice_engine::{Command, Config, Deps, Engine, ErrorEvent, Event, Source, State, Timing};
use voice_models::{Cancel, Store};

use crate::audio::AudioState;
use crate::rt::AppHandle;

pub const MAIN: &str = "main";
const MODELS_DIR: &str = "voice-models";
const PHRASES_DIR: &str = "voice-phrases";
const QUIT_WITHIN: Duration = Duration::from_millis(500);

pub struct Voice {
    pub engine: Engine,
    pub store: Arc<Store>,
    pub config: Mutex<Config>,
    pub star: AtomicBool,
    pub devices: Mutex<Option<DeviceList>>,
    pub watching: Mutex<Option<Arc<AtomicBool>>>,
    pub last: Mutex<(State, Option<ErrorEvent>)>,
    pub installs: Mutex<HashMap<String, Cancel>>,
    pub progress: Mutex<HashMap<String, (u64, u64)>>,
    pub rounds: chat::Rounds,
}

pub fn init(app: &AppHandle, data_dir: &Path, cache_dir: &Path, rt: Handle, premium: bool) {
    let audio = app.state::<AudioState>();
    let tap = RefTap::new();
    let fetch = Arc::new(fetch::ModelFetch { rt: rt.clone() });
    let store = Arc::new(Store::new(data_dir.join(MODELS_DIR), fetch));
    let retired = store.clone();
    rt.spawn_blocking(move || retired.drop_retired());
    let deps = Deps {
        capture: Capture::new(tap.clone()),
        store: store.clone(),
        catalog: Arc::new(catalog::ResolveCatalog {
            app: app.clone(),
            rt: rt.clone(),
        }),
        output: Box::new(output::MasterOutput::new(
            audio.master.clone(),
            audio.active_output.clone(),
            tap,
        )),
        devices: DeviceList::default(),
        timing: Timing::default(),
        phrases: cache_dir.join(PHRASES_DIR),
        voice: None,
        server: Some(Arc::new(server::ApiServer {
            app: app.clone(),
            rt,
        })),
    };
    let (engine, events) = Engine::start(deps);
    engine.send(Command::Star(premium));
    app.manage(Voice {
        engine,
        store,
        config: Mutex::new(Config::default()),
        star: AtomicBool::new(premium),
        devices: Mutex::new(None),
        watching: Mutex::new(None),
        last: Mutex::new((State::Idle, None)),
        installs: Mutex::new(HashMap::new()),
        progress: Mutex::new(HashMap::new()),
        rounds: chat::Rounds::default(),
    });
    events::forward(app.clone(), events);
}

impl Voice {
    fn note(&self, event: &Event) {
        let mut last = self.last.lock().unwrap();
        match event {
            Event::State(state) => {
                last.0 = state.state;
                if state.state == State::Listening {
                    last.1 = None;
                }
            }
            Event::Error(error) => last.1 = Some(error.clone()),
            Event::Cancelled(turn) => self.rounds.cancel(&turn.id),
            _ => {}
        }
    }

    fn required(&self) -> Vec<String> {
        voice_engine::required(&self.config.lock().unwrap(), &self.store)
    }

    pub fn active(&self) -> bool {
        self.star.load(Ordering::Relaxed) && self.config.lock().unwrap().enabled
    }
}

pub fn quit(app: &AppHandle) {
    if let Some(voice) = app.try_state::<Voice>() {
        voice.engine.quit(QUIT_WITHIN);
    }
}

pub fn apply(app: &AppHandle, config: Config) {
    let voice = app.state::<Voice>();
    *voice.config.lock().unwrap() = config.clone();
    voice.engine.send(Command::Apply(Box::new(config)));
    activation(app);
}

pub fn star_changed(app: &AppHandle, premium: bool) {
    let Some(voice) = app.try_state::<Voice>() else {
        return;
    };
    if voice.star.swap(premium, Ordering::Relaxed) == premium {
        return;
    }
    voice.engine.send(Command::Star(premium));
    activation(app);
}

fn activation(app: &AppHandle) {
    let voice = app.state::<Voice>();
    let active = voice.active();
    let hotkey = voice.config.lock().unwrap().activation.hotkey.clone();
    crate::app::hotkeys::set_voice_key(app, hotkey.filter(|_| active));
    devices::watch(app, active);
}

pub fn hotkey(app: &AppHandle, pressed: bool) {
    let Some(voice) = app.try_state::<Voice>() else {
        return;
    };
    let command = if pressed {
        Command::Press(Source::Hotkey)
    } else {
        Command::Release(Source::Hotkey)
    };
    voice.engine.send(command);
}

pub fn headset_presses(app: &AppHandle) -> u8 {
    let Some(voice) = app.try_state::<Voice>() else {
        return 0;
    };
    if !voice.active() {
        return 0;
    }
    voice.config.lock().unwrap().activation.headset.presses()
}

pub fn headset_gesture(app: &AppHandle) {
    if let Some(voice) = app.try_state::<Voice>() {
        voice.engine.send(Command::Start(Source::Headset));
    }
}
