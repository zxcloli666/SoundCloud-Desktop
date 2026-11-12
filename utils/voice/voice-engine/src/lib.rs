mod cache;
mod catalog;
mod clip;
mod config;
mod draft;
mod event;
#[cfg(test)]
mod fixtures;
mod gesture;
mod hotwords;
mod kokoro;
mod listen;
mod lookup;
mod machine;
mod memory;
mod models;
mod output;
mod pauses;
mod plain;
mod plan;
mod qwen;
mod read;
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
use std::time::{Duration, Instant};

use memory::Memory;
use voice_audio::{Capture, DeviceList};
use voice_models::Store;
use voice_nlu::{Kind, Variant};
use voice_resolve::Entity;

pub use catalog::Catalog;
pub use clip::Clip;
pub use config::{
    Activation, Boosts, Config, Echo, Headset, Language, Listen, ListenMode, Speak, SpeakMode, Wake,
};
pub use event::{
    Ahead, CommandEvent, DecisionEvent, EntityEvent, ErrorEvent, Event, HeardEvent, LevelEvent,
    Looked, Outcome, PartialEvent, ScoredEvent, Source, Spoke, State, StateEvent, Timed, TurnEvent,
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
    Reread(String),
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
    pub opening: Duration,
}

impl Default for Timing {
    fn default() -> Self {
        Self {
            no_speech: Duration::from_secs(4),
            max_utterance: Duration::from_secs(12),
            ask: Duration::from_secs(8),
            done: Duration::from_secs(10),
            lookup: Duration::from_millis(1200),
            chat: Duration::from_secs(60),
            synth: Duration::from_secs(30),
            release: Duration::from_millis(80),
            opening: Duration::from_millis(700),
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
    catalog: Arc<dyn Catalog>,
    memory: Arc<Memory>,
}

impl Engine {
    pub fn start(deps: Deps) -> (Engine, Receiver<Event>) {
        let (inbox, messages) = channel();
        let (events_tx, events) = channel();
        let engine = Engine {
            inbox: inbox.clone(),
            catalog: deps.catalog.clone(),
            memory: Arc::default(),
        };
        let memory = engine.memory.clone();
        std::thread::Builder::new()
            .name("voice-engine".into())
            .spawn(move || machine::Core::new(deps, memory, events_tx, inbox).run(messages))
            .expect("spawn voice-engine");
        (engine, events)
    }

    pub fn send(&self, command: Command) {
        let _ = self.inbox.send(machine::Msg::Command(command));
    }

    pub fn candidates(
        &self,
        variants: &[Variant],
        kinds: &[Kind],
    ) -> (Result<Vec<Entity>, String>, Looked) {
        if let Some(found) = self.memory.recalled(variants, kinds) {
            return (Ok(found), Looked::Remembered);
        }
        let asked = Instant::now();
        let found = self.memory.asked(&*self.catalog, variants, kinds);
        (found, Looked::In(asked.elapsed()))
    }
}
