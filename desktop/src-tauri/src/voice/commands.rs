use serde::Serialize;
use tauri::State as Managed;
use tauri::ipc::Channel;
use voice_chat::ChatEvent;
use voice_engine::{Command, Config, EntityEvent, ErrorEvent, Outcome, Source, State};

use super::chat::{self, Refused, Turn};
use super::devices::{self, Devices};
use super::models::{self, ModelInfo};
use super::{Voice, catalog, previews};
use crate::rt::AppHandle;

#[derive(Serialize)]
pub struct ModelsSummary {
    ready: usize,
    total: usize,
}

#[derive(Serialize)]
pub struct Status {
    state: State,
    star: bool,
    models: ModelsSummary,
    devices: Devices,
    error: Option<ErrorEvent>,
}

#[tauri::command]
pub async fn voice_status(voice: Managed<'_, Voice>) -> Result<Status, String> {
    let (state, error) = voice.last.lock().unwrap().clone();
    let (ready, total) = models::summary(&voice);
    let known = if voice.active() {
        devices::current(&voice)
    } else {
        voice.devices.lock().unwrap().clone().unwrap_or_default()
    };
    Ok(Status {
        state,
        star: voice.star.load(std::sync::atomic::Ordering::Relaxed),
        models: ModelsSummary { ready, total },
        devices: devices::shape(&known),
        error,
    })
}

#[tauri::command]
pub fn voice_apply(app: AppHandle, config: Config) {
    super::apply(&app, config);
}

#[tauri::command]
pub async fn voice_start(voice: Managed<'_, Voice>, source: Source) -> Result<(), String> {
    devices::current(&voice);
    voice.engine.send(Command::Start(source));
    Ok(())
}

#[tauri::command]
pub fn voice_stop(voice: Managed<'_, Voice>) {
    voice.engine.send(Command::Stop);
}

#[tauri::command]
pub fn voice_cancel(voice: Managed<'_, Voice>) {
    voice.engine.send(Command::Cancel);
}

#[tauri::command]
pub fn voice_text(voice: Managed<'_, Voice>, text: String, source: Source, id: Option<String>) {
    voice.engine.send(Command::Text { text, source, id });
}

#[tauri::command]
pub fn voice_answer(voice: Managed<'_, Voice>, choice: String) {
    voice.engine.send(Command::Answer(choice));
}

#[tauri::command]
pub fn voice_done(voice: Managed<'_, Voice>, id: String, outcome: Outcome) {
    voice.rounds.settle(&id);
    voice.engine.send(Command::Done { id, outcome });
}

#[tauri::command]
pub fn voice_reread(voice: Managed<'_, Voice>, id: String) {
    voice.rounds.settle(&id);
    voice.engine.send(Command::Reread(id));
}

#[tauri::command]
pub async fn voice_chat(
    app: AppHandle,
    voice: Managed<'_, Voice>,
    turn: Turn,
    events: Channel<ChatEvent>,
) -> Result<(), Refused> {
    chat::round(&app, &voice, turn, &events).await
}

#[tauri::command]
pub fn voice_chat_cancel(voice: Managed<'_, Voice>, id: String) {
    chat::cancel(&voice, id);
}

#[tauri::command]
pub async fn voice_resolve(
    voice: Managed<'_, Voice>,
    query: String,
    kinds: Vec<String>,
) -> Result<Vec<EntityEvent>, String> {
    catalog::search(&voice, &query, &kinds).await
}

#[tauri::command]
pub async fn voice_devices(voice: Managed<'_, Voice>) -> Result<Devices, String> {
    Ok(devices::shape(&devices::refresh(&voice)))
}

#[tauri::command]
pub async fn voice_meter(voice: Managed<'_, Voice>, on: bool) -> Result<(), String> {
    if on {
        devices::current(&voice);
    }
    voice.engine.send(Command::Meter(on));
    Ok(())
}

#[tauri::command]
pub async fn voice_models(voice: Managed<'_, Voice>) -> Result<Vec<ModelInfo>, String> {
    Ok(models::list(&voice))
}

#[tauri::command]
pub async fn voice_model_get(app: AppHandle, id: String) -> Result<(), String> {
    models::get(&app, &id)
}

#[tauri::command]
pub async fn voice_model_delete(app: AppHandle, id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || models::delete(&app, &id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn voice_preview(voice: Managed<'_, Voice>, voice_id: String) -> Result<(), String> {
    let clip = previews::clip(&voice_id).ok_or("unknown voice")?;
    voice.engine.send(Command::Preview(clip.to_vec()));
    Ok(())
}

#[tauri::command]
pub fn voice_wake_teach(step: String) -> Result<u32, String> {
    Err(format!("wake word is not available yet ({step})"))
}
