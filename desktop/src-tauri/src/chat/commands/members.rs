use sc_chat::api::wire::{MemberChange, MemberView, NewInvite};
use sc_chat::{
    ChatError, ChatRequest, ChatResult, ConvId, ConversationSummary, Invite, InviteOptions, Member,
    MemberRole, UserId,
};

use super::conversations::refreshed;
use super::convert;
use super::reads::blocking;
use crate::chat::state::ChatState;

pub async fn list(state: &ChatState, conversation_id: ConvId) -> ChatResult<Vec<Member>> {
    match state.api.members(conversation_id).await {
        Ok(views) => adopt(state, conversation_id, views).await,
        Err(ChatError::Offline) => {
            blocking(state, move |core| core.store.members(conversation_id)).await
        }
        Err(error) => Err(error),
    }
}

pub async fn add(
    state: &ChatState,
    conversation_id: ConvId,
    users: Vec<UserId>,
) -> ChatResult<Vec<Member>> {
    if users.is_empty() {
        return Err(ChatError::Invalid);
    }
    state.api.add_members(conversation_id, &users).await?;
    state.runtime.kick();
    list(state, conversation_id).await
}

pub async fn remove(state: &ChatState, conversation_id: ConvId, user_id: UserId) -> ChatResult<()> {
    state
        .api
        .remove_member(conversation_id, &user_id, false)
        .await?;
    state.runtime.kick();
    Ok(())
}

pub async fn set_role(
    state: &ChatState,
    conversation_id: ConvId,
    user_id: UserId,
    role: MemberRole,
) -> ChatResult<Member> {
    let change = MemberChange {
        role: Some(role),
        unban: false,
    };
    let views = state
        .api
        .update_member(conversation_id, &user_id, &change)
        .await?;
    adopt(state, conversation_id, views)
        .await?
        .into_iter()
        .find(|member| member.user.id == user_id)
        .ok_or(ChatError::NotFound)
}

pub async fn requests(state: &ChatState) -> ChatResult<Vec<ChatRequest>> {
    let listed = state.api.requests().await?;
    blocking(state, move |core| {
        let senders: Vec<UserId> = listed
            .requests
            .iter()
            .map(|view| view.from.clone())
            .collect();
        let people = convert::people(&core.store, &senders);
        listed
            .requests
            .iter()
            .zip(people)
            .map(|(view, from)| {
                let stored = core.store.conversation(view.conversation_id)?;
                Ok(convert::request(view, stored, from))
            })
            .collect()
    })
    .await
}

pub async fn invite_create(
    state: &ChatState,
    conversation_id: ConvId,
    options: InviteOptions,
) -> ChatResult<Invite> {
    let body = NewInvite {
        expires_in_s: options.expires_in_s,
        uses: options.uses,
    };
    let view = state.api.create_invite(conversation_id, &body).await?;
    Ok(Invite::from(&view))
}

pub async fn invite_revoke(state: &ChatState, token: String) -> ChatResult<()> {
    state.api.revoke_invite(&token).await
}

pub async fn invite_join(state: &ChatState, token: String) -> ChatResult<ConversationSummary> {
    let joined = state.api.join_invite(&token).await?;
    state.runtime.kick();
    refreshed(state, joined.conversation_id).await
}

async fn adopt(
    state: &ChatState,
    conversation_id: ConvId,
    views: Vec<MemberView>,
) -> ChatResult<Vec<Member>> {
    blocking(state, move |core| {
        let ids: Vec<UserId> = views.iter().map(|view| view.user_id.clone()).collect();
        let members: Vec<Member> = views
            .iter()
            .zip(convert::people(&core.store, &ids))
            .map(|(view, user)| convert::member(view, user))
            .collect();
        core.store.put_members(conversation_id, &members)?;
        Ok(members)
    })
    .await
}
