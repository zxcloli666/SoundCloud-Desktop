use sc_chat::api::wire::{MyChange, NewConversation};
use sc_chat::envelope::Content;
use sc_chat::{
    ChatError, ChatResult, ConvId, ConversationKind, ConversationMeta, ConversationPatch,
    ConversationSummary, CoreEvent, CreateConversation, DeleteScope, GoneEvent,
    is_disappearing_ttl,
};

use super::compose::queue;
use super::reads::blocking;
use crate::chat::state::ChatState;

pub async fn create(
    state: &ChatState,
    input: CreateConversation,
) -> ChatResult<ConversationSummary> {
    let core = state.core()?;
    let body = NewConversation {
        kind: input.kind,
        members: input.members,
        meta_ct: None,
        meta_epoch: None,
    };
    let view = state.api.create_conversation(&body).await?;
    let summary = core.sync.adopt(&view).await?;
    let title = input.title.filter(|title| !title.trim().is_empty());
    if let (ConversationKind::Group, Some(title)) = (input.kind, title) {
        let meta = ConversationMeta {
            title,
            description: String::new(),
            avatar: None,
        };
        queue(state, view.id, None, Content::Meta(meta)).await?;
    }
    Ok(summary)
}

pub async fn update(
    state: &ChatState,
    conversation_id: ConvId,
    patch: ConversationPatch,
) -> ChatResult<ConversationSummary> {
    if patch.meta.is_some() || patch.avatar.is_some() {
        let next = patch.clone();
        let meta = blocking(state, move |core| {
            core.store.next_meta(conversation_id, &next)
        })
        .await?;
        queue(state, conversation_id, None, Content::Meta(meta)).await?;
    }
    match patch.me {
        Some(mine) => {
            let view = state
                .api
                .update_me(conversation_id, &MyChange::from(&mine))
                .await?;
            state.core()?.sync.adopt(&view).await
        }
        None => refreshed(state, conversation_id).await,
    }
}

pub async fn delete(
    state: &ChatState,
    conversation_id: ConvId,
    scope: DeleteScope,
) -> ChatResult<()> {
    state
        .api
        .delete_conversation(conversation_id, scope)
        .await?;
    forget(state, conversation_id).await
}

pub async fn set_ttl(
    state: &ChatState,
    conversation_id: ConvId,
    ttl_s: Option<u32>,
) -> ChatResult<ConversationSummary> {
    if ttl_s.is_some_and(|ttl| !is_disappearing_ttl(ttl)) {
        return Err(ChatError::Invalid);
    }
    state.api.set_ttl(conversation_id, ttl_s).await?;
    state.runtime.kick();
    refreshed(state, conversation_id).await
}

pub async fn accept(state: &ChatState, conversation_id: ConvId) -> ChatResult<ConversationSummary> {
    state.api.accept(conversation_id).await?;
    refreshed(state, conversation_id).await
}

pub async fn decline(state: &ChatState, conversation_id: ConvId) -> ChatResult<()> {
    state.api.decline(conversation_id).await?;
    forget(state, conversation_id).await
}

pub async fn refreshed(
    state: &ChatState,
    conversation_id: ConvId,
) -> ChatResult<ConversationSummary> {
    state
        .core()?
        .sync
        .refresh_conversation(conversation_id)
        .await
}

async fn forget(state: &ChatState, conversation_id: ConvId) -> ChatResult<()> {
    blocking(state, move |core| {
        core.store.purge_conversations(&[conversation_id])?;
        core.sync.load_tally()
    })
    .await?;
    state.events.emit(CoreEvent::Gone(GoneEvent {
        conversations: vec![conversation_id],
        messages: Vec::new(),
    }));
    Ok(())
}
