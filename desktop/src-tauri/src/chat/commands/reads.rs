use sc_chat::{
    ChatError, ChatResult, ConvId, ConversationPage, EmbedPage, EmbedsQuery, HistoryPage,
    HistoryQuery, ListQuery, RichText, SearchHit, SearchQuery, ThreadSnapshot, UserId,
};

use crate::chat::runtime::Core;
use crate::chat::state::ChatState;

const LIST_MAX: u32 = 200;
const HISTORY_MAX: u32 = 200;
const OPEN_PAGE: u32 = 50;
const SEARCH_MAX: u32 = 100;
const EMBEDS_MAX: u32 = 100;

pub async fn blocking<T, F>(state: &ChatState, work: F) -> ChatResult<T>
where
    T: Send + 'static,
    F: FnOnce(&Core) -> ChatResult<T> + Send + 'static,
{
    let core = state.core()?;
    state
        .rt
        .spawn_blocking(move || work(&core))
        .await
        .map_err(|_| ChatError::Internal)?
}

pub async fn list(state: &ChatState, query: ListQuery) -> ChatResult<ConversationPage> {
    let query = ListQuery {
        limit: query.limit.clamp(1, LIST_MAX),
        ..query
    };
    blocking(state, move |core| core.store.conversations(&query)).await
}

pub async fn open(state: &ChatState, conversation_id: ConvId) -> ChatResult<ThreadSnapshot> {
    let typing = state.runtime.typing(conversation_id);
    blocking(state, move |core| snapshot(core, conversation_id, typing)).await
}

fn snapshot(
    core: &Core,
    conversation_id: ConvId,
    typing: Vec<UserId>,
) -> ChatResult<ThreadSnapshot> {
    let conversation = core
        .store
        .conversation(conversation_id)?
        .ok_or(ChatError::NotFound)?;
    let latest = HistoryQuery {
        before: None,
        after: None,
        limit: OPEN_PAGE,
    };
    let page = core.store.messages(conversation_id, &latest)?;
    let mut messages = page.messages;
    messages.extend(core.outbox.pending(conversation_id)?);
    let pins = messages
        .iter()
        .filter(|message| message.pinned)
        .filter_map(|message| message.seq)
        .collect();
    Ok(ThreadSnapshot {
        conversation,
        more_before: page.more,
        marks: core.store.marks(conversation_id)?,
        pins,
        typing,
        draft: core.store.draft(conversation_id)?,
        messages,
    })
}

pub async fn history(
    state: &ChatState,
    conversation_id: ConvId,
    query: HistoryQuery,
) -> ChatResult<HistoryPage> {
    let query = HistoryQuery {
        limit: query.limit.clamp(1, HISTORY_MAX),
        ..query
    };
    let local = blocking(state, move |core| {
        core.store.messages(conversation_id, &query)
    })
    .await?;
    if !reaches_back(&query, &local) {
        return Ok(local);
    }
    let core = state.core()?;
    match core.sync.fetch_history(conversation_id, &query).await {
        Ok(page) => Ok(page),
        Err(_) => Ok(local),
    }
}

pub fn reaches_back(query: &HistoryQuery, local: &HistoryPage) -> bool {
    query.after.is_none() && local.messages.len() < query.limit as usize
}

pub async fn save_draft(
    state: &ChatState,
    conversation_id: ConvId,
    draft: Option<RichText>,
) -> ChatResult<()> {
    let draft = draft.filter(|draft| !draft.text.trim().is_empty());
    blocking(state, move |core| {
        core.store.save_draft(conversation_id, draft.as_ref())
    })
    .await
}

pub async fn search(state: &ChatState, query: SearchQuery) -> ChatResult<Vec<SearchHit>> {
    if query.text.trim().is_empty() {
        return Ok(Vec::new());
    }
    let query = SearchQuery {
        limit: query.limit.clamp(1, SEARCH_MAX),
        ..query
    };
    blocking(state, move |core| core.search.query(&query)).await
}

pub async fn embeds(
    state: &ChatState,
    conversation_id: ConvId,
    query: EmbedsQuery,
) -> ChatResult<EmbedPage> {
    let query = EmbedsQuery {
        limit: query.limit.clamp(1, EMBEDS_MAX),
        ..query
    };
    blocking(state, move |core| {
        core.store.embeds(conversation_id, &query)
    })
    .await
}
