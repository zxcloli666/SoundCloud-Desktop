use std::path::PathBuf;
use std::sync::Arc;

use voice_models::{Kind, Status, Store};
use voice_qwen::Paths;
use voice_speech::Model;

use crate::config::{Config, Language};
use crate::server::Server;
use crate::tts::Source;
use crate::voices::{self, Voice};

pub const VAD: &str = "silero-vad";
pub const ASR_RU: &str = "sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16";
pub const ASR_EN: &str = "sherpa-onnx-zipformer-gigaspeech-2023-12-12";

const PROGRAM: &str = if cfg!(windows) {
    "scd-qwen.exe"
} else {
    "scd-qwen"
};

pub fn asr(language: Language) -> (&'static str, Model) {
    match language {
        Language::Ru => (ASR_RU, Model::Streaming),
        Language::En => (ASR_EN, Model::Batch),
    }
}

fn engine(store: &Store) -> Option<&str> {
    let models = &store.manifest().models;
    let engine = models.iter().find(|model| model.kind == Kind::Engine)?;
    Some(&engine.id)
}

fn parts<'a>(voice: &'a Voice, store: &'a Store) -> Option<Vec<&'a str>> {
    let ids = match voice.kind {
        voices::Kind::Kokoro { .. } => vec![voice.model],
        voices::Kind::Qwen { .. } => vec![engine(store)?, voices::QWEN_CODEC, voice.model],
    };
    ids.iter()
        .all(|id| store.manifest().get(id).is_ok())
        .then_some(ids)
}

pub fn hearing(config: &Config) -> [&'static str; 2] {
    [VAD, asr(config.language).0]
}

pub fn required(config: &Config, store: &Store) -> Vec<String> {
    let mut ids: Vec<String> = hearing(config).iter().map(|id| id.to_string()).collect();
    let voice = voices::find(&config.speak.voice);
    if config.speak.replies
        && !on_server(config, voice)
        && let Some(parts) = parts(voice, store)
    {
        ids.extend(parts.into_iter().map(str::to_string));
    }
    ids
}

pub fn on_server(config: &Config, voice: &Voice) -> bool {
    config.speak.server && matches!(voice.kind, voices::Kind::Qwen { .. })
}

pub fn ready(store: &Store, id: &str) -> bool {
    matches!(store.status(id), Ok(Status::Ready))
}

pub fn dir(store: &Store, id: &str) -> Option<PathBuf> {
    if ready(store, id) {
        store.model_dir(id).ok()
    } else {
        None
    }
}

pub fn qwen(store: &Store, voice: &Voice) -> Option<Paths> {
    let voices::Kind::Qwen { file, .. } = voice.kind else {
        return None;
    };
    Some(Paths {
        program: dir(store, engine(store)?)?.join(PROGRAM),
        talker: dir(store, voice.model)?.join(file),
        codec: dir(store, voices::QWEN_CODEC)?.join(voices::QWEN_CODEC_FILE),
    })
}

pub fn source(store: &Store, voice: &Voice) -> Option<Source> {
    match voice.kind {
        voices::Kind::Kokoro { file, speaker } => Some(Source::Kokoro {
            dir: dir(store, voice.model)?,
            file,
            speaker,
        }),
        voices::Kind::Qwen { speaker, .. } => Some(Source::Qwen {
            paths: qwen(store, voice)?,
            speaker,
            cached_as: cached_as(store, voice)?,
        }),
    }
}

pub fn server(
    voice: &'static Voice,
    server: Arc<dyn Server>,
    local: Option<Source>,
) -> Option<Source> {
    match voice.kind {
        voices::Kind::Qwen { .. } => Some(Source::Server {
            voice: voice.id,
            server,
            local: local.map(Box::new),
        }),
        voices::Kind::Kokoro { .. } => local,
    }
}

fn cached_as(store: &Store, voice: &Voice) -> Option<String> {
    let voices::Kind::Qwen { speaker, .. } = voice.kind else {
        return None;
    };
    let version = &store.manifest().get(voice.model).ok()?.version;
    Some(format!("{}/{version}/{speaker}", voice.model))
}
