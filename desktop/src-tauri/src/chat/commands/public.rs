use std::sync::Arc;

use sc_chat::api::Api;
use sc_chat::api::wire::LogEntry;
use sc_chat::{
    ChatResult, ConvId, ConversationKind, ConversationSummary, Millis, PublicOpened, Seq, UserCard,
    UserId, UserRef,
};
use serde::Serialize;
use tokio::task::JoinSet;
use uuid::Uuid;

use super::conversations::refreshed;
use super::convert;
use super::reads::blocking;
use crate::chat::state::ChatState;

const LOG_MAX: u32 = 200;
const CARDS_MAX: usize = 24;
const PEOPLE_MAX: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicLogEntry {
    pub id: Uuid,
    pub by: UserRef,
    pub action: String,
    pub user: Option<UserRef>,
    pub seq: Option<Seq>,
    pub until: Option<Millis>,
    pub seconds: Option<u32>,
    pub reason: Option<String>,
    pub ts: Millis,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicLog {
    pub entries: Vec<PublicLogEntry>,
    pub next: Option<Uuid>,
}

pub async fn open(state: &ChatState) -> ChatResult<PublicOpened> {
    let opened = state.core()?.sync.open_public().await?;
    state.runtime.kick();
    Ok(opened)
}

pub async fn focused(state: &ChatState, conversation_id: Option<ConvId>) {
    let public = match conversation_id {
        Some(id) => blocking(state, move |core| {
            Ok(core
                .store
                .conversation(id)?
                .is_some_and(|summary| summary.kind == ConversationKind::Public))
        })
        .await
        .unwrap_or(false),
        None => false,
    };
    state.runtime.watch_public(public);
}

pub async fn moderator(state: &ChatState, user_id: UserId, on: bool) -> ChatResult<()> {
    state.api.public_moderator(&user_id, on).await
}

pub async fn mute(
    state: &ChatState,
    user_id: UserId,
    seconds: u32,
    reason: Option<String>,
) -> ChatResult<Millis> {
    let muted = state
        .api
        .public_mute(&user_id, seconds, reason.as_deref())
        .await?;
    Ok(muted.until)
}

pub async fn unmute(state: &ChatState, user_id: UserId) -> ChatResult<()> {
    state.api.public_unmute(&user_id).await
}

pub async fn ban(state: &ChatState, user_id: UserId, reason: Option<String>) -> ChatResult<()> {
    state.api.public_ban(&user_id, reason.as_deref()).await
}

pub async fn unban(state: &ChatState, user_id: UserId) -> ChatResult<()> {
    state.api.public_unban(&user_id).await
}

pub async fn slow_mode(
    state: &ChatState,
    conversation_id: ConvId,
    seconds: u32,
) -> ChatResult<ConversationSummary> {
    state.api.public_slow_mode(seconds).await?;
    state.runtime.kick();
    refreshed(state, conversation_id).await
}

pub async fn log(
    state: &ChatState,
    before: Option<Uuid>,
    limit: Option<u32>,
) -> ChatResult<PublicLog> {
    let page = state
        .api
        .public_log(before, limit.map(|limit| limit.clamp(1, LOG_MAX)))
        .await?;
    let mut ids: Vec<UserId> = Vec::new();
    for entry in &page.entries {
        for id in [Some(entry.by.clone()), target_user(entry)]
            .into_iter()
            .flatten()
        {
            if !ids.contains(&id) {
                ids.push(id);
            }
        }
    }
    let people = named(state, ids).await?;
    let find = |id: &str| {
        people
            .iter()
            .find(|user| user.id == id)
            .cloned()
            .unwrap_or_else(|| convert::bare(id))
    };
    let entries = page
        .entries
        .iter()
        .map(|entry| PublicLogEntry {
            id: entry.id,
            by: find(&entry.by),
            action: entry.action.clone(),
            user: target_user(entry).map(|id| find(&id)),
            seq: target_seq(entry),
            until: entry.detail.get("until").and_then(|value| value.as_i64()),
            seconds: entry
                .detail
                .get("seconds")
                .and_then(|value| value.as_u64())
                .and_then(|seconds| u32::try_from(seconds).ok()),
            reason: entry
                .detail
                .get("reason")
                .and_then(|value| value.as_str())
                .map(str::to_owned),
            ts: entry.ts,
        })
        .collect();
    Ok(PublicLog {
        entries,
        next: page.next,
    })
}

fn target_user(entry: &LogEntry) -> Option<UserId> {
    if let Some(user) = entry.target.strip_prefix("user:") {
        return Some(user.to_owned());
    }
    if entry.target.starts_with("message:") {
        return entry
            .detail
            .get("author")
            .and_then(|value| value.as_str())
            .map(str::to_owned);
    }
    if entry.target.starts_with("conversation:") {
        return None;
    }
    Some(entry.target.clone())
}

fn target_seq(entry: &LogEntry) -> Option<Seq> {
    entry
        .target
        .strip_prefix("message:")
        .and_then(|rest| rest.rsplit(':').next())
        .and_then(|seq| seq.parse().ok())
}

pub async fn people(state: &ChatState, ids: Vec<UserId>) -> ChatResult<Vec<UserRef>> {
    let mut ids = ids;
    ids.sort();
    ids.dedup();
    ids.truncate(PEOPLE_MAX);
    named(state, ids).await
}

async fn named(state: &ChatState, ids: Vec<UserId>) -> ChatResult<Vec<UserRef>> {
    let wanted = ids.clone();
    let mut known = blocking(state, move |core| Ok(convert::people(&core.store, &wanted))).await?;
    let unknown: Vec<UserId> = known
        .iter()
        .filter(|user| user.name == user.id)
        .map(|user| user.id.clone())
        .take(CARDS_MAX)
        .collect();
    if unknown.is_empty() {
        return Ok(known);
    }
    let fetched = cards(state.api.clone(), unknown).await;
    if !fetched.is_empty() {
        let users = fetched.clone();
        blocking(state, move |core| core.store.put_users(&users)).await?;
    }
    for user in fetched {
        if let Some(slot) = known.iter_mut().find(|known| known.id == user.id) {
            *slot = user;
        }
    }
    Ok(known)
}

async fn cards(api: Arc<Api>, ids: Vec<UserId>) -> Vec<UserRef> {
    let mut tasks = JoinSet::new();
    for id in ids {
        let api = api.clone();
        tasks.spawn(async move { api.user_card(&id).await.ok() });
    }
    let mut users = Vec::new();
    while let Some(done) = tasks.join_next().await {
        if let Ok(Some(view)) = done {
            users.push(UserCard::from(&view).user);
        }
    }
    users
}
