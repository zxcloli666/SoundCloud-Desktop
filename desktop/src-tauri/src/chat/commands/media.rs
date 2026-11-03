use sc_chat::api::wire::{
    DeleteAnswer, MediaSelection, MediaUsage, MinePage, RestoreAnswer, UrlsAnswer,
};
use sc_chat::media::queue;
use sc_chat::{ChatResult, ConvId, MineQuery};
use uuid::Uuid;

use crate::chat::state::ChatState;
use crate::chat::upload::{self, UploadView};

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
    paths: Vec<String>,
) -> ChatResult<Vec<UploadView>> {
    upload::enqueue(state, conversation_id, paths).await
}

pub async fn uploads(state: &ChatState) -> ChatResult<Vec<UploadView>> {
    upload::list(state).await
}

pub async fn upload_retry(state: &ChatState, id: Uuid) -> ChatResult<()> {
    upload::retry(state, id).await
}

pub async fn upload_cancel(state: &ChatState, id: Uuid) -> ChatResult<()> {
    upload::cancel(state, id).await
}

pub async fn cache_size(state: &ChatState) -> ChatResult<u64> {
    state.media_cache.size()
}

pub async fn cache_clear(state: &ChatState) -> ChatResult<u64> {
    state.media_cache.clear()
}
