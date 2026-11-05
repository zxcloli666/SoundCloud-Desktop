mod exchange;
#[cfg(test)]
mod harness;
mod lane;
mod node;
mod pow;
mod wire;

use std::sync::{Arc, OnceLock};

use sc_chat::channel::{InnerAnswer, InnerCall};
use sc_chat::{
    ChatError, ChatResult, LinkClaimed, LinkCreated, LinkMode, LinkPoll, LinkState, LoginBegin,
    LoginPoll, LoginState, LoginTarget,
};
use serde_json::{Value, json};
use tauri::Emitter;
use uuid::Uuid;

use super::events::AUTH_CHECKING;
use super::keychain::Keychain;
use super::state::ChatState;
use exchange::{Call, Signer};
use lane::Lane;
use node::{Node, Nodes};

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
    let (node, answer) = start(state, &signer, &call).await?;
    let begun: LoginBegin = wire::decode(&answer)?;
    lane().hold(&begun.login_request_id, signer, node);
    Ok(begun)
}

pub async fn poll(state: &ChatState, login_request_id: &str) -> ChatResult<LoginPoll> {
    let query = by_id(login_request_id)?;
    let (signer, order) = following(state, login_request_id).await?;
    let call = Call::new(get(LOGIN_STATUS, query), None, POLL_TIMEOUT_MS);
    let (_, answer) = send(state, &order, &signer, &call).await?;
    let polled = wire::login_poll(&answer)?;
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
    let (node, answer) = start(state, &signer, &call).await?;
    let created: LinkCreated = wire::decode(&answer)?;
    lane().hold(&created.link_request_id, signer, node);
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
    let (_, answer) = start(state, &signer, &claim_call(claim_token, session)).await?;
    wire::decode(&answer)
}

fn claim_call(claim_token: &str, session: Option<String>) -> Call {
    let body = json!({ "claimToken": claim_token });
    Call::new(post(LINK_CLAIM, &body), session, START_TIMEOUT_MS)
}

pub async fn link_poll(state: &ChatState, link_request_id: &str) -> ChatResult<LinkPoll> {
    let query = by_id(link_request_id)?;
    let (signer, order) = following(state, link_request_id).await?;
    let call = Call::new(get(LINK_STATUS, query), None, POLL_TIMEOUT_MS);
    let (_, answer) = send(state, &order, &signer, &call).await?;
    let polled = wire::link_poll(&answer)?;
    if polled.status != LinkState::Pending {
        lane().release(link_request_id);
    }
    Ok(polled)
}

pub fn forget_held() {
    lane().release_all();
}

#[tauri::command]
pub fn chat_auth_cancel() {
    lane().cancel();
}

fn lane() -> &'static Lane {
    static LANE: OnceLock<Lane> = OnceLock::new();
    LANE.get_or_init(Lane::new)
}

fn nodes() -> &'static Nodes {
    static NODES: OnceLock<Nodes> = OnceLock::new();
    NODES.get_or_init(Nodes::edge)
}

async fn start(state: &ChatState, signer: &Signer, call: &Call) -> ChatResult<(Node, InnerAnswer)> {
    send(state, &Node::ALL, signer, call).await
}

async fn send(
    state: &ChatState,
    order: &[Node],
    signer: &Signer,
    call: &Call,
) -> ChatResult<(Node, InnerAnswer)> {
    let checking = |on: bool| {
        let _ = state.app.emit(AUTH_CHECKING, on);
    };
    lane().send(nodes(), order, signer, call, &checking).await
}

async fn following(state: &ChatState, request_id: &str) -> ChatResult<(Arc<Signer>, Vec<Node>)> {
    match lane().held(request_id) {
        Some((signer, node)) => Ok((signer, vec![node])),
        None => {
            let signer = swept_signer(lane(), state.keys.clone()).await?;
            Ok((signer, Node::ALL.to_vec()))
        }
    }
}

async fn load_signer(state: &ChatState) -> ChatResult<Arc<Signer>> {
    match swept_signer(lane(), state.keys.clone()).await {
        Err(ChatError::Keychain | ChatError::KeychainDenied) => {
            state.runtime.reset_keys().await?;
            swept_signer(lane(), state.keys.clone()).await
        }
        loaded => loaded,
    }
}

async fn swept_signer(lane: &Lane, keychain: Arc<Keychain>) -> ChatResult<Arc<Signer>> {
    let sweeping = keychain.clone();
    tokio::task::spawn_blocking(move || sweeping.sweep())
        .await
        .map_err(|_| ChatError::Keychain)??;
    lane.signer(keychain).await
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
mod pow_tests;
#[cfg(test)]
mod sealed_tests;
#[cfg(test)]
mod tests;
