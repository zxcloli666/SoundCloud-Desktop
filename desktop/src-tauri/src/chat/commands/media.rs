use sc_chat::api::wire::{
    DeleteAnswer, MediaSelection, MediaUsage, MinePage, RestoreAnswer, UrlsAnswer,
};
use sc_chat::media::queue;
use sc_chat::{
    ChatError, ChatResult, ConvId, MediaUploadView, Message, MineQuery, ReportReason, SendInput,
};
use uuid::Uuid;

use super::reads::blocking;
use crate::chat::download::{MediaRef, keyed};
use crate::chat::state::ChatState;
use crate::chat::{backdrop, upload};

pub async fn usage(state: &ChatState) -> ChatResult<MediaUsage> {
    state.api.media_usage().await
}

pub async fn mine(state: &ChatState, query: MineQuery) -> ChatResult<MinePage> {
    state.api.media_mine(&query).await
}

pub async fn delete(state: &ChatState, selection: MediaSelection) -> ChatResult<DeleteAnswer> {
    state.api.delete_media(&selection).await
}

pub async fn restore(state: &ChatState, selection: MediaSelection) -> ChatResult<RestoreAnswer> {
    state.api.restore_media(&selection).await
}

pub async fn urls(
    state: &ChatState,
    conversation_id: Option<ConvId>,
    ids: Vec<Uuid>,
) -> ChatResult<UrlsAnswer> {
    queue::urls(&state.api, conversation_id, &ids).await
}

pub async fn attach(
    state: &ChatState,
    conversation_id: ConvId,
    album: Option<Uuid>,
    paths: Vec<String>,
) -> ChatResult<Vec<MediaUploadView>> {
    upload::enqueue(state, conversation_id, album, paths).await
}

pub async fn attach_data(
    state: &ChatState,
    conversation_id: ConvId,
    album: Option<Uuid>,
    data: Vec<u8>,
) -> ChatResult<Vec<MediaUploadView>> {
    upload::enqueue_data(state, conversation_id, album, data).await
}

pub async fn send(state: &ChatState, input: SendInput, album: Uuid) -> ChatResult<Message> {
    upload::send_album(state, input, album).await
}

pub async fn album_cancel(state: &ChatState, album: Uuid) -> ChatResult<()> {
    upload::cancel_album(state, album).await
}

pub async fn avatar(
    state: &ChatState,
    conversation_id: ConvId,
    path: String,
) -> ChatResult<MediaUploadView> {
    upload::avatar(state, conversation_id, path).await
}

pub async fn backdrop(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    preset: Option<String>,
) -> ChatResult<()> {
    backdrop::set_preset(state, code, conversation_id, preset).await
}

pub async fn backdrop_upload(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    path: String,
) -> ChatResult<Option<MediaUploadView>> {
    backdrop::upload(state, code, conversation_id, path).await
}

pub async fn backdrop_stored(
    state: &ChatState,
    code: String,
    conversation_id: ConvId,
    source: ConvId,
    media_id: Uuid,
) -> ChatResult<Option<MediaUploadView>> {
    backdrop::upload_stored(state, code, conversation_id, source, media_id).await
}

pub async fn backdrop_stop(state: &ChatState, conversation_id: ConvId) -> ChatResult<()> {
    backdrop::stop(state, conversation_id).await
}

pub async fn known(state: &ChatState, media: Vec<MediaRef>) -> ChatResult<Vec<Uuid>> {
    blocking(state, move |core| keyed(&core.store, &media)).await
}

pub async fn backdrop_report(
    state: &ChatState,
    conversation_id: ConvId,
    media_id: Uuid,
    reason: ReportReason,
    comment: Option<String>,
) -> ChatResult<()> {
    backdrop::report(state, conversation_id, media_id, reason, comment).await
}

pub async fn uploads(state: &ChatState) -> ChatResult<Vec<MediaUploadView>> {
    blocking(state, |core| {
        Ok(core
            .store
            .uploads()?
            .iter()
            .map(MediaUploadView::from)
            .collect())
    })
    .await
}

pub async fn parked(state: &ChatState) -> ChatResult<Vec<Uuid>> {
    blocking(state, |core| {
        let mut albums: Vec<(ConvId, Uuid)> = core
            .store
            .uploads()?
            .iter()
            .map(|upload| (upload.conversation_id, upload.album))
            .collect();
        albums.sort_unstable();
        albums.dedup();
        let mut parked = Vec::new();
        for (conversation_id, album) in albums {
            if upload::parked(&core.store, conversation_id, album)?.is_some() {
                parked.push(album);
            }
        }
        Ok(parked)
    })
    .await
}

pub async fn upload_retry(state: &ChatState, id: Uuid) -> ChatResult<()> {
    upload::retry(state, id).await
}

pub async fn upload_cancel(state: &ChatState, id: Uuid) -> ChatResult<()> {
    upload::cancel(state, id).await
}

pub async fn cache_size(state: &ChatState) -> ChatResult<u64> {
    let cache = state.media_cache.clone();
    state
        .rt
        .spawn_blocking(move || cache.size())
        .await
        .map_err(|_| ChatError::Internal)?
}

pub async fn cache_clear(state: &ChatState) -> ChatResult<u64> {
    let cache = state.media_cache.clone();
    state
        .rt
        .spawn_blocking(move || cache.clear())
        .await
        .map_err(|_| ChatError::Internal)?
}
