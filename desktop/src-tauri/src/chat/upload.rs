mod album;
mod attach;
mod avatar;
mod backdrop;
mod cancel;
mod chat_backdrop;
mod delete_queue;
mod deletes;
mod driver;
mod engine;
mod errors;
mod files;
mod halt;
mod host;
mod picked;
mod plain;
mod post;
mod prepare;
mod progress;
mod put;
mod round;
mod schedule;
mod seed;
mod single;
mod step;
mod turns;

use std::path::PathBuf;

use sc_chat::{ChatError, ChatResult, ConvId, MediaUploadView, Message, SendInput};
use tauri::Manager;
use tauri_plugin_fs::FsExt;
use uuid::Uuid;

use super::state::ChatState;
use crate::app::diagnostics;
use crate::rt::AppHandle;
use attach::Source;

pub use engine::Uploads;
pub use files::DIR as UPLOADS_DIR;
pub use host::RuntimeHost;
pub use post::pending_post as parked;
pub use prepare::read_source;

pub fn start(state: &ChatState) {
    host::watch(&state.app, &state.uploads);
    state.rt.spawn(state.uploads.clone().run());
}

pub fn dropped(app: &AppHandle, paths: &[PathBuf]) {
    if let Some(state) = app.try_state::<ChatState>() {
        state.uploads.picked.drop_in(paths);
    }
}

pub async fn chosen(state: &ChatState, path: String) -> ChatResult<PathBuf> {
    let path = PathBuf::from(path);
    let picked = state
        .app
        .try_fs_scope()
        .is_some_and(|scope| scope.is_allowed(&path));
    if picked || state.uploads.picked.holds(&path).await {
        return Ok(path);
    }
    diagnostics::warn("[ChatUpload] refused a path the user did not pick");
    Err(ChatError::Invalid)
}

pub async fn enqueue(
    state: &ChatState,
    conversation_id: ConvId,
    album: Option<Uuid>,
    paths: Vec<String>,
) -> ChatResult<Vec<MediaUploadView>> {
    let mut sources = Vec::with_capacity(paths.len());
    for path in paths {
        sources.push(Source::Path(chosen(state, path).await?));
    }
    state.uploads.attach(conversation_id, album, sources).await
}

pub async fn enqueue_data(
    state: &ChatState,
    conversation_id: ConvId,
    album: Option<Uuid>,
    data: Vec<u8>,
) -> ChatResult<Vec<MediaUploadView>> {
    state
        .uploads
        .attach(conversation_id, album, vec![Source::Data(data)])
        .await
}

pub async fn send_album(state: &ChatState, input: SendInput, album: Uuid) -> ChatResult<Message> {
    state.uploads.send_album(input, album).await
}

pub async fn cancel_album(state: &ChatState, album: Uuid) -> ChatResult<()> {
    state.uploads.cancel_album(album).await
}

pub async fn avatar(
    state: &ChatState,
    conversation_id: ConvId,
    path: String,
) -> ChatResult<MediaUploadView> {
    let path = chosen(state, path).await?;
    state.uploads.avatar(conversation_id, path).await
}

pub async fn retry(state: &ChatState, id: Uuid) -> ChatResult<()> {
    state.uploads.retry(id).await
}

pub async fn cancel(state: &ChatState, id: Uuid) -> ChatResult<()> {
    state.uploads.cancel(id).await
}

pub async fn is_album(state: &ChatState, id: Uuid) -> ChatResult<bool> {
    state.uploads.has_album(id).await
}

#[cfg(test)]
mod tests;
