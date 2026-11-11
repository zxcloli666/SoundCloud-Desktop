mod cache;
mod catalog;
mod clip;
mod config;
mod draft;
mod event;
mod gesture;
mod hotwords;
mod kokoro;
mod listen;
mod lookup;
mod machine;
mod models;
mod output;
mod plain;
mod plan;
mod qwen;
mod sentences;
mod shape;
mod speak;
mod speaker;
mod speech;
mod stream;
mod tts;
mod turn;
mod voices;
mod wire;

use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender, channel};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use voice_audio::{Capture, DeviceList};
use voice_models::Store;

pub use catalog::Catalog;
pub use clip::Clip;
pub use config::{
    Activation, Boosts, Config, Echo, Headset, Language, Listen, ListenMode, Speak, SpeakMode, Wake,
};
pub use event::{
    CommandEvent, DecisionEvent, EntityEvent, ErrorEvent, Event, LevelEvent, Looked, Outcome,
    PartialEvent, ScoredEvent, Source, State, StateEvent, Timed, TurnEvent,
};
pub use gesture::{Press, Presses};
pub use models::{ASR_EN, ASR_RU, VAD, hearing, required};
pub use output::Output;
pub use stream::Stream;
pub use tts::Voice;
pub use turn::Chat;
pub use voice_qwen::Sink;
pub use voices::KOKORO;

pub enum Command {
    Apply(Box<Config>),
    Star(bool),
    Devices(DeviceList),
    Models,
    Start(Source),
    Press(Source),
    Release(Source),
    Stop,
    Cancel,
    Text {
        text: String,
        source: Source,
        id: Option<String>,
    },
    Answer(String),
    Done {
        id: String,
        outcome: Outcome,
    },
    Chat {
        id: String,
        step: Chat,
    },
    Meter(bool),
    Preview(Vec<u8>),
}

#[derive(Clone, Copy, Debug)]
pub struct Timing {
    pub no_speech: Duration,
    pub max_utterance: Duration,
    pub ask: Duration,
    pub done: Duration,
    pub lookup: Duration,
    pub chat: Duration,
    pub synth: Duration,
    pub release: Duration,
}

impl Default for Timing {
    fn default() -> Self {
        Self {
            no_speech: Duration::from_secs(4),
            max_utterance: Duration::from_secs(12),
            ask: Duration::from_secs(8),
            done: Duration::from_secs(10),
            lookup: Duration::from_millis(1500),
            chat: Duration::from_secs(60),
            synth: Duration::from_secs(30),
            release: Duration::from_millis(80),
        }
    }
}

pub struct Deps {
    pub capture: Capture,
    pub store: Arc<Store>,
    pub catalog: Arc<dyn Catalog>,
    pub output: Box<dyn Output>,
    pub devices: DeviceList,
    pub timing: Timing,
    pub phrases: PathBuf,
    pub voice: Option<Arc<Mutex<dyn Voice>>>,
}

#[derive(Clone)]
pub struct Engine {
    inbox: Sender<machine::Msg>,
}

impl Engine {
    pub fn start(deps: Deps) -> (Engine, Receiver<Event>) {
        let (inbox, messages) = channel();
        let (events_tx, events) = channel();
        let own = inbox.clone();
        std::thread::Builder::new()
            .name("voice-engine".into())
            .spawn(move || machine::Core::new(deps, events_tx, own).run(messages))
            .expect("spawn voice-engine");
        (Engine { inbox }, events)
    }

    pub fn send(&self, command: Command) {
        let _ = self.inbox.send(machine::Msg::Command(command));
    }
}
