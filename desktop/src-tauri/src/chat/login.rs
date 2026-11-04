mod exchange;
mod lane;
mod wire;

use std::sync::{Arc, OnceLock};

use sc_chat::channel::{InnerAnswer, InnerCall};
use sc_chat::{
    ChatError, ChatResult, LinkClaimed, LinkCreated, LinkMode, LinkPoll, LinkState, LoginBegin,
    LoginPoll, LoginState, LoginTarget,
};
use serde_json::{Value, json};
use uuid::Uuid;

use super::state::ChatState;
use exchange::{Call, Signer};
use lane::Lane;

const LOGIN: &str = "/auth/login";
const LOGIN_STATUS: &str = "/auth/login/status";
const LINK_CREATE: &str = "/auth/link/create";
const LINK_CLAIM: &str = "/auth/link/claim";
const LINK_STATUS: &str = "/auth/link/status";

const START_TIMEOUT_MS: u64 = 8_000;
const POLL_TIMEOUT_MS: u64 = 10_000;

pub async fn begin(state: &ChatState, target: LoginTarget) -> ChatResult<LoginBegin> {
    let session = match target {
        LoginTarget::Fresh => None,
        LoginTarget::Current => crate::auth::session_token(Some(&state.app)).await,
    };
    let signer = load_signer(state).await?;
    let call = Call::new(get(LOGIN, String::new()), session, START_TIMEOUT_MS);
    let begun: LoginBegin = wire::decode(&send(state, &signer, &call).await?)?;
    lane().hold(&begun.login_request_id, signer);
    Ok(begun)
}

pub async fn poll(state: &ChatState, login_request_id: &str) -> ChatResult<LoginPoll> {
    let query = by_id(login_request_id)?;
    let signer = held_signer(state, login_request_id).await?;
    let call = Call::new(get(LOGIN_STATUS, query), None, POLL_TIMEOUT_MS);
    let polled = wire::login_poll(&send(state, &signer, &call).await?)?;
    if polled.status != LoginState::Pending {
        lane().release(login_request_id);
    }
    Ok(polled)
}

pub async fn link_create_pull(state: &ChatState) -> ChatResult<LinkCreated> {
    create_link(state, LinkMode::Pull, None).await
}

#[tauri::command]
pub async fn chat_link_create_push(state: tauri::State<'_, ChatState>) -> ChatResult<LinkCreated> {
    link_create_push(&state).await
}

pub async fn link_create_push(state: &ChatState) -> ChatResult<LinkCreated> {
    let session = crate::auth::session_token(Some(&state.app))
        .await
        .ok_or(ChatError::NotReady)?;
    create_link(state, LinkMode::Push, Some(session)).await
}

async fn create_link(
    state: &ChatState,
    mode: LinkMode,
    session: Option<String>,
) -> ChatResult<LinkCreated> {
    let signer = load_signer(state).await?;
    let body = json!({ "mode": mode });
    let call = Call::new(post(LINK_CREATE, &body), session, START_TIMEOUT_MS);
    let created: LinkCreated = wire::decode(&send(state, &signer, &call).await?)?;
    lane().hold(&created.link_request_id, signer);
    Ok(created)
}

pub async fn link_claim_push(state: &ChatState, claim_token: &str) -> ChatResult<LinkClaimed> {
    claim_link(state, claim_token, None).await
}

#[tauri::command]
pub async fn chat_link_claim_pull(
    state: tauri::State<'_, ChatState>,
    claim_token: String,
) -> ChatResult<LinkClaimed> {
    link_claim_pull(&state, &claim_token).await
}

pub async fn link_claim_pull(state: &ChatState, claim_token: &str) -> ChatResult<LinkClaimed> {
    let session = crate::auth::session_token(Some(&state.app))
        .await
        .ok_or(ChatError::NotReady)?;
    claim_link(state, claim_token, Some(session)).await
}

async fn claim_link(
    state: &ChatState,
    claim_token: &str,
    session: Option<String>,
) -> ChatResult<LinkClaimed> {
    let signer = load_signer(state).await?;
    wire::decode(&send(state, &signer, &claim_call(claim_token, session)).await?)
}

fn claim_call(claim_token: &str, session: Option<String>) -> Call {
    let body = json!({ "claimToken": claim_token });
    Call::new(post(LINK_CLAIM, &body), session, START_TIMEOUT_MS)
}

pub async fn link_poll(state: &ChatState, link_request_id: &str) -> ChatResult<LinkPoll> {
    let query = by_id(link_request_id)?;
    let signer = held_signer(state, link_request_id).await?;
    let call = Call::new(get(LINK_STATUS, query), None, POLL_TIMEOUT_MS);
    let polled = wire::link_poll(&send(state, &signer, &call).await?)?;
    if polled.status != LinkState::Pending {
        lane().release(link_request_id);
    }
    Ok(polled)
}

fn lane() -> &'static Lane {
    static LANE: OnceLock<Lane> = OnceLock::new();
    LANE.get_or_init(Lane::new)
}

async fn send(state: &ChatState, signer: &Signer, call: &Call) -> ChatResult<InnerAnswer> {
    lane().send(state.transport.as_ref(), signer, call).await
}

async fn held_signer(state: &ChatState, request_id: &str) -> ChatResult<Arc<Signer>> {
    match lane().held(request_id) {
        Some(signer) => Ok(signer),
        None => load_signer(state).await,
    }
}

async fn load_signer(state: &ChatState) -> ChatResult<Arc<Signer>> {
    lane().signer(state.keys.clone()).await
}

fn get(path: &str, query: String) -> InnerCall {
    InnerCall {
        method: "GET".to_owned(),
        path: path.to_owned(),
        query,
        body: Vec::new(),
    }
}

fn post(path: &str, body: &Value) -> InnerCall {
    InnerCall {
        method: "POST".to_owned(),
        path: path.to_owned(),
        query: String::new(),
        body: body.to_string().into_bytes(),
    }
}

fn by_id(request_id: &str) -> ChatResult<String> {
    let id = Uuid::parse_str(request_id).map_err(|_| ChatError::Invalid)?;
    Ok(format!("id={id}"))
}

#[cfg(test)]
mod sealed_tests;
#[cfg(test)]
mod tests;
