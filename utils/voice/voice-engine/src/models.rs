use std::path::PathBuf;

use voice_models::{Status, Store};
use voice_speech::Model;

use crate::config::{Config, Language};
use crate::voices;

pub const VAD: &str = "silero-vad";
pub const ASR_RU: &str = "sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16";
pub const ASR_EN: &str = "sherpa-onnx-moonshine-base-en-quantized-2026-02-27";

pub fn asr(language: Language) -> (&'static str, Model) {
    match language {
        Language::Ru => (ASR_RU, Model::Zipformer),
        Language::En => (ASR_EN, Model::Moonshine),
    }
}

pub fn required(config: &Config, store: &Store) -> Vec<&'static str> {
    let mut ids = vec![VAD, asr(config.language).0];
    if config.speak.replies
        && let Some(voice) = voices::find(&config.speak.voice)
        && store.manifest().get(voice.model).is_ok()
    {
        ids.push(voice.model);
    }
    ids
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
