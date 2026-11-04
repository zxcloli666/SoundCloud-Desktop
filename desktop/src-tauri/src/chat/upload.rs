mod album;
mod attach;
mod avatar;
mod cancel;
mod driver;
mod engine;
mod errors;
mod files;
mod host;
mod prepare;
mod progress;
mod put;
mod single;
mod step;

use std::path::PathBuf;

use sc_chat::{ChatResult, ConvId, MediaUploadView, Message, SendInput};
use uuid::Uuid;

use super::state::ChatState;
use attach::Source;

pub use engine::Uploads;
pub use host::RuntimeHost;

pub fn start(state: &ChatState) {
    host::watch(&state.app, &state.uploads);
    state.rt.spawn(state.uploads.clone().run());
}

pub async fn enqueue(
    state: &ChatState,
    conversation_id: ConvId,
    album: Option<Uuid>,
    paths: Vec<String>,
) -> ChatResult<Vec<MediaUploadView>> {
    let sources = paths
        .into_iter()
        .map(|path| Source::Path(PathBuf::from(path)))
        .collect();
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
    state
        .uploads
        .avatar(conversation_id, PathBuf::from(path))
        .await
}

pub async fn retry(state: &ChatState, id: Uuid) -> ChatResult<()> {
    state.uploads.retry(id).await
}

pub async fn cancel(state: &ChatState, id: Uuid) -> ChatResult<()> {
    state.uploads.cancel(id).await
}

pub async fn is_album(state: &ChatState, id: Uuid) -> bool {
    state.uploads.has_album(id).await
}

#[cfg(test)]
mod tests;
