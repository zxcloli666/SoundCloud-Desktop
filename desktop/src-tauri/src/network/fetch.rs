use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::task::AbortHandle;
use wreq::header::{CONTENT_LENGTH, HeaderMap, HeaderName, HeaderValue};
use wreq::{Method, redirect::Policy};

use crate::network::edge::{Hop, Tier};
use crate::network::fail::{self, FailKind};
use crate::network::netcheck::{model::Role, paths};
use crate::network::{dns, system_proxy};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const BODY_STALL: Duration = Duration::from_secs(10);
const IDLE_PER_HOST: usize = 8;
const MAX_REDIRECTS: usize = 10;
const MAX_MESSAGE: usize = 400;
const DROPPED: [&str; 3] = ["host", "content-length", "connection"];

static INFLIGHT: LazyLock<Mutex<HashMap<u32, AbortHandle>>> = LazyLock::new(Mutex::default);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchRequest {
    id: u32,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_ms: Option<u64>,
    route: Option<Route>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    tier: Tier,
    origin: String,
    attempt: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NetKind {
    Aborted,
    Timeout,
    Dns,
    Connect,
    Tls,
    Reset,
    Body,
    Other,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetFailure {
    kind: NetKind,
    message: String,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(untagged, rename_all = "camelCase")]
pub enum Head {
    #[serde(rename_all = "camelCase")]
    Answer {
        status: u16,
        status_text: String,
        headers: Vec<(String, String)>,
        url: String,
    },
    Failed {
        error: NetFailure,
    },
}

impl Head {
    fn failed(kind: NetKind, message: impl Into<String>) -> Self {
        let mut message = message.into();
        if message.len() > MAX_MESSAGE {
            let cut = (0..=MAX_MESSAGE)
                .rev()
                .find(|at| message.is_char_boundary(*at))
                .unwrap_or(0);
            message.truncate(cut);
        }
        Self::Failed {
            error: NetFailure { kind, message },
        }
    }
}

pub fn client() -> Option<&'static wreq::Client> {
    static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            configured(system_proxy::follow(sc_fingerprint::builder(None)))
                .build()
                .ok()
        })
        .as_ref()
}

pub fn configured(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    builder
        .redirect(Policy::limited(MAX_REDIRECTS))
        .pool_max_idle_per_host(IDLE_PER_HOST)
        .connect_timeout(CONNECT_TIMEOUT)
}

fn inflight() -> MutexGuard<'static, HashMap<u32, AbortHandle>> {
    INFLIGHT.lock().unwrap_or_else(|poison| poison.into_inner())
}

#[tauri::command]
pub async fn net_fetch(request: FetchRequest) -> tauri::ipc::Response {
    let Some(client) = client() else {
        let head = Head::failed(NetKind::Other, "http client is unavailable");
        return tauri::ipc::Response::new(frame(&head, &[]));
    };
    let id = request.id;
    let task = tokio::spawn(perform(client, request));
    inflight().insert(id, task.abort_handle());
    let done = task.await;
    inflight().remove(&id);
    let (head, body) =
        done.unwrap_or_else(|_| (Head::failed(NetKind::Aborted, "aborted"), Vec::new()));
    tauri::ipc::Response::new(frame(&head, &body))
}

#[tauri::command]
pub fn net_fetch_cancel(id: u32) {
    if let Some(handle) = inflight().remove(&id) {
        handle.abort();
    }
}

async fn perform(client: &wreq::Client, request: FetchRequest) -> (Head, Vec<u8>) {
    let started = Instant::now();
    let deadline = request
        .timeout_ms
        .map(|ms| tokio::time::Instant::now() + Duration::from_millis(ms));
    let Ok(method) = Method::from_bytes(request.method.to_ascii_uppercase().as_bytes()) else {
        return (Head::failed(NetKind::Other, "bad method"), Vec::new());
    };
    let headers = outgoing(&method, &request.headers, request.body.is_some());
    let mut builder = client.request(method, &request.url).headers(headers);
    if let Some(body) = request.body.clone() {
        builder = builder.body(body);
    }
    let response = match within(deadline, builder.send()).await {
        None => {
            settle(&request, Err(FailKind::Timeout), started);
            return (
                Head::failed(NetKind::Timeout, "no answer in time"),
                Vec::new(),
            );
        }
        Some(Err(error)) => {
            let kind = fail::of_wreq(&error);
            settle(&request, Err(kind), started);
            return (Head::failed(net_kind(kind), described(&error)), Vec::new());
        }
        Some(Ok(response)) => response,
    };
    let status = response.status();
    settle(&request, Ok(status.as_u16()), started);
    let head = Head::Answer {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or_default().to_string(),
        headers: incoming(response.headers()),
        url: response.url().to_string(),
    };
    match read_body(response, deadline).await {
        Ok(body) => (head, body),
        Err(message) => (Head::failed(NetKind::Body, message), Vec::new()),
    }
}

async fn read_body(
    mut response: wreq::Response,
    deadline: Option<tokio::time::Instant>,
) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    loop {
        let stall_at = tokio::time::Instant::now() + BODY_STALL;
        let until = deadline.map_or(stall_at, |at| at.min(stall_at));
        match tokio::time::timeout_at(until, response.chunk()).await {
            Err(_) if until < stall_at => {
                return Err("timed out while reading the body".to_string());
            }
            Err(_) => return Err("the body stalled".to_string()),
            Ok(Err(error)) => return Err(described(&error)),
            Ok(Ok(None)) => return Ok(body),
            Ok(Ok(Some(chunk))) => body.extend_from_slice(&chunk),
        }
    }
}

async fn within<F: Future>(deadline: Option<tokio::time::Instant>, work: F) -> Option<F::Output> {
    match deadline {
        Some(at) => tokio::time::timeout_at(at, work).await.ok(),
        None => Some(work.await),
    }
}

fn settle(request: &FetchRequest, outcome: Result<u16, FailKind>, started: Instant) {
    if outcome.is_err()
        && let Some(host) = host_of(&request.url)
    {
        dns::suspect(&host);
    }
    let Some(route) = &request.route else { return };
    let hop = Hop {
        url: request.url.clone(),
        tier: route.tier,
        origin: route.origin.clone(),
    };
    let role = Role::of_index(usize::from(route.attempt));
    paths::record(&hop, role, outcome, started.elapsed(), "api");
}

fn host_of(url: &str) -> Option<String> {
    url::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
}

pub fn outgoing(method: &Method, headers: &[(String, String)], has_body: bool) -> HeaderMap {
    let mut map = HeaderMap::new();
    for (name, value) in headers {
        if DROPPED
            .iter()
            .any(|dropped| name.eq_ignore_ascii_case(dropped))
        {
            continue;
        }
        if let (Ok(name), Ok(value)) = (
            HeaderName::from_bytes(name.as_bytes()),
            HeaderValue::from_str(value),
        ) {
            map.append(name, value);
        }
    }
    if !has_body && matches!(*method, Method::POST | Method::PUT) {
        map.insert(CONTENT_LENGTH, HeaderValue::from_static("0"));
    }
    map
}

fn incoming(headers: &HeaderMap) -> Vec<(String, String)> {
    headers
        .iter()
        .map(|(name, value)| {
            (
                name.as_str().to_string(),
                String::from_utf8_lossy(value.as_bytes()).into_owned(),
            )
        })
        .collect()
}

pub fn net_kind(kind: FailKind) -> NetKind {
    match kind {
        FailKind::Dns | FailKind::DnsBogus => NetKind::Dns,
        FailKind::Timeout => NetKind::Timeout,
        FailKind::Refused | FailKind::Unreachable => NetKind::Connect,
        FailKind::Reset | FailKind::Closed => NetKind::Reset,
        FailKind::TlsCert | FailKind::Tls => NetKind::Tls,
        FailKind::Body => NetKind::Body,
        FailKind::Status | FailKind::Other => NetKind::Other,
    }
}

fn described(error: &wreq::Error) -> String {
    let mut text = error.to_string();
    if let Some(url) = error.url() {
        text = text.replace(&format!(" for url ({})", url.as_str()), "");
    }
    let mut cause = std::error::Error::source(error);
    while let Some(current) = cause {
        let part = current.to_string();
        if !text.contains(&part) {
            text.push_str(": ");
            text.push_str(&part);
        }
        cause = current.source();
    }
    text
}

pub fn frame(head: &Head, body: &[u8]) -> Vec<u8> {
    let json = serde_json::to_vec(head).unwrap_or_else(|_| b"{}".to_vec());
    let mut out = Vec::with_capacity(4 + json.len() + body.len());
    out.extend_from_slice(&(json.len() as u32).to_be_bytes());
    out.extend_from_slice(&json);
    out.extend_from_slice(body);
    out
}

#[cfg(test)]
#[path = "fetch_tests.rs"]
mod tests;
