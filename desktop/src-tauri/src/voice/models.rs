use std::sync::mpsc::channel;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{Emitter, Manager};
use voice_engine::Command;
use voice_models::{Cancel, Error, Kind, Progress, Status};

use super::{MAIN, Voice};
use crate::app::diagnostics;
use crate::rt::AppHandle;

const PROGRESS_EVERY: Duration = Duration::from_millis(150);
const BUSY_WAIT: Duration = Duration::from_millis(100);
const BUSY_TRIES: u32 = 50;

#[derive(Serialize)]
pub struct ModelInfo {
    id: String,
    kind: &'static str,
    language: String,
    size: u64,
    state: &'static str,
    done: u64,
    total: u64,
    license: String,
    optional: bool,
    listen: bool,
}

#[derive(Serialize, Clone)]
struct ModelProgress {
    id: String,
    state: &'static str,
    done: u64,
    total: u64,
}

fn kind_name(kind: Kind) -> &'static str {
    match kind {
        Kind::Vad => "vad",
        Kind::Asr => "asr",
        Kind::Kws => "wake",
        Kind::Tts => "tts",
        Kind::Llm => "llm",
        Kind::Aux => "aux",
        Kind::Engine => "engine",
    }
}

fn state_of(voice: &Voice, id: &str, total: u64) -> (&'static str, u64) {
    if let Some((done, _)) = voice.progress.lock().unwrap().get(id) {
        return ("downloading", *done);
    }
    if voice.installs.lock().unwrap().contains_key(id) {
        return ("downloading", 0);
    }
    match voice.store.status(id) {
        Ok(Status::Ready) => ("ready", total),
        Ok(Status::Partial(done)) => ("partial", done),
        Ok(Status::Corrupted) => ("corrupted", 0),
        Ok(Status::Missing) | Err(_) => ("missing", 0),
    }
}

pub fn list(voice: &Voice) -> Vec<ModelInfo> {
    let required = voice.required();
    let hearing = voice_engine::hearing(&voice.config.lock().unwrap());
    voice
        .store
        .manifest()
        .models
        .iter()
        .map(|model| {
            let (state, done) = state_of(voice, &model.id, model.unpacked_size);
            ModelInfo {
                id: model.id.clone(),
                kind: kind_name(model.kind),
                language: model.language.clone(),
                size: model.unpacked_size,
                state,
                done,
                total: model.unpacked_size,
                license: model.license.clone(),
                optional: !required.iter().any(|id| *id == model.id),
                listen: hearing.contains(&model.id.as_str()),
            }
        })
        .collect()
}

pub fn summary(voice: &Voice) -> (usize, usize) {
    let required = voice.required();
    let ready = required
        .iter()
        .filter(|id| matches!(voice.store.status(id), Ok(Status::Ready)))
        .count();
    (ready, required.len())
}

fn emit_state(app: &AppHandle, voice: &Voice, id: &str) {
    let Ok(model) = voice.store.manifest().get(id) else {
        return;
    };
    let (state, done) = state_of(voice, id, model.unpacked_size);
    let progress = ModelProgress {
        id: id.to_string(),
        state,
        done,
        total: model.unpacked_size,
    };
    app.emit_to(MAIN, "voice:models", progress).ok();
}

pub fn get(app: &AppHandle, id: &str) -> Result<(), String> {
    let voice = app.state::<Voice>();
    let model = voice.store.manifest().get(id).map_err(|e| e.to_string())?;
    let ids: Vec<String> = model
        .requires
        .iter()
        .cloned()
        .chain([id.to_string()])
        .collect();
    let cancel = {
        let mut installs = voice.installs.lock().unwrap();
        if installs.contains_key(id) {
            return Ok(());
        }
        let cancel = Cancel::new();
        installs.insert(id.to_string(), cancel.clone());
        cancel
    };
    let app = app.clone();
    let id = id.to_string();
    std::thread::Builder::new()
        .name("voice-models".into())
        .spawn(move || install(&app, &id, &ids, &cancel))
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn install(app: &AppHandle, id: &str, ids: &[String], cancel: &Cancel) {
    let voice = app.state::<Voice>();
    let (tx, rx) = channel::<Progress>();
    let reporter = {
        let app = app.clone();
        std::thread::Builder::new()
            .name("voice-progress".into())
            .spawn(move || {
                let voice = app.state::<Voice>();
                let mut last = Instant::now() - PROGRESS_EVERY;
                for progress in rx {
                    voice.progress.lock().unwrap().insert(
                        progress.model.clone(),
                        (progress.model_done, progress.model_total),
                    );
                    if last.elapsed() < PROGRESS_EVERY && progress.model_done < progress.model_total
                    {
                        continue;
                    }
                    last = Instant::now();
                    let event = ModelProgress {
                        id: progress.model,
                        state: "downloading",
                        done: progress.model_done,
                        total: progress.model_total,
                    };
                    app.emit_to(MAIN, "voice:models", event).ok();
                }
            })
    };
    let result = voice.store.install(id, cancel, Some(&tx));
    drop(tx);
    if let Ok(reporter) = reporter {
        let _ = reporter.join();
    }
    voice.installs.lock().unwrap().remove(id);
    {
        let mut progress = voice.progress.lock().unwrap();
        for model in ids {
            progress.remove(model);
        }
    }
    for model in ids {
        emit_state(app, &voice, model);
    }
    match result {
        Ok(()) => voice.engine.send(Command::Models),
        Err(Error::Cancelled) => {}
        Err(error) => {
            diagnostics::warn(format!("[Voice] model {id} failed: {error}"));
            let code = match error {
                Error::Sha256Mismatch { .. } => "model_corrupt",
                _ => "network",
            };
            let event = voice_engine::ErrorEvent {
                code,
                detail: Some(error.to_string()),
            };
            app.emit_to(MAIN, "voice:error", event).ok();
        }
    }
}

pub fn delete(app: &AppHandle, id: &str) -> Result<(), String> {
    let voice = app.state::<Voice>();
    if let Some(cancel) = voice.installs.lock().unwrap().get(id) {
        cancel.cancel();
    }
    let mut tries = 0;
    let result = loop {
        match voice.store.delete(id) {
            Err(Error::Busy(_)) if tries < BUSY_TRIES => {
                tries += 1;
                std::thread::sleep(BUSY_WAIT);
            }
            other => break other,
        }
    };
    voice.engine.send(Command::Models);
    emit_state(app, &voice, id);
    result.map_err(|e| e.to_string())
}
