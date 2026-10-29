use std::collections::HashMap;
use std::sync::{LazyLock, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::task::AbortHandle;
use wreq::header::{CONTENT_LENGTH, HeaderMap, HeaderName, HeaderValue};
use wreq::http2::Http2Options;
use wreq::{Method, redirect::Policy};

use crate::diag::trace;
use crate::network::edge::{Hop, Tier};
use crate::network::fail::{self, FailKind};
use crate::network::netcheck::model::Role;
use crate::network::pace::{self, Pace};
use crate::network::traced;
use crate::network::{dns, system_proxy};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const BODY_STALL: Duration = Duration::from_secs(10);
const PING_TIMEOUT: Duration = Duration::from_secs(5);
const IDLE_PER_HOST: usize = 8;
const MAX_REDIRECTS: usize = 10;
const MAX_MESSAGE: usize = 400;
const DROPPED: [&str; 3] = ["host", "content-length", "connection"];
const PINGS_GAVE_UP: &str = "keep-alive timed out";

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
    #[serde(default)]
    long_poll: bool,
    trace: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    tier: Tier,
    origin: String,
    attempt: u8,
    #[serde(default)]
    last: bool,
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
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        stalled: bool,
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
    pooled(pace::now())
}

fn pooled(pace: Pace) -> Option<&'static wreq::Client> {
    static QUICK: OnceLock<Option<wreq::Client>> = OnceLock::new();
    static PATIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    let cell = match pace {
        Pace::Quick => &QUICK,
        Pace::Patient => &PATIENT,
    };
    cell.get_or_init(|| built(pace, IDLE_PER_HOST)).as_ref()
}

fn one_shot() -> Option<&'static wreq::Client> {
    static ONE_SHOT: OnceLock<Option<wreq::Client>> = OnceLock::new();
    ONE_SHOT.get_or_init(|| built(Pace::Patient, 0)).as_ref()
}

fn built(pace: Pace, idle: usize) -> Option<wreq::Client> {
    let (_, emulation) = sc_fingerprint::emulation(None);
    let builder = sc_fingerprint::from_emulation(pinging(emulation, pace));
    configured(system_proxy::follow(builder))
        .pool_max_idle_per_host(idle)
        .build()
        .ok()
}

pub fn configured(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    builder
        .redirect(Policy::limited(MAX_REDIRECTS))
        .pool_max_idle_per_host(IDLE_PER_HOST)
        .connect_timeout(CONNECT_TIMEOUT)
}

pub fn pinging(mut emulation: wreq::Emulation, pace: Pace) -> wreq::Emulation {
    if let Some(http2) = emulation.http2_options.as_mut() {
        ping(http2, pace);
    }
    emulation
}

fn ping(http2: &mut Http2Options, pace: Pace) {
    http2.keep_alive_interval = Some(pace.silence());
    http2.keep_alive_timeout = PING_TIMEOUT;
    http2.keep_alive_while_idle = false;
}

fn inflight() -> MutexGuard<'static, HashMap<u32, AbortHandle>> {
    INFLIGHT.lock().unwrap_or_else(|poison| poison.into_inner())
}

#[tauri::command]
pub async fn net_fetch(request: FetchRequest) -> tauri::ipc::Response {
    let (Some(pooled), Some(fresh)) = (client(), one_shot()) else {
        let head = Head::failed(NetKind::Other, "http client is unavailable");
        return tauri::ipc::Response::new(frame(&head, &[]));
    };
    let id = request.id;
    let task = tokio::spawn(perform(pooled, fresh, request));
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

async fn perform(
    pooled: &wreq::Client,
    fresh: &wreq::Client,
    request: FetchRequest,
) -> (Head, Vec<u8>) {
    let id = request
        .trace
        .clone()
        .filter(|id| trace::valid_trace(id))
        .unwrap_or_else(trace::new_trace);
    let (head, body, answered_in) = trace::within(id, exchange(pooled, fresh, &request)).await;
    if let Some(took) = answered_in {
        pace::note(took);
    }
    (head, body)
}

async fn exchange(
    pooled: &wreq::Client,
    fresh: &wreq::Client,
    request: &FetchRequest,
) -> (Head, Vec<u8>, Option<Duration>) {
    let deadline = request
        .timeout_ms
        .map(|ms| tokio::time::Instant::now() + Duration::from_millis(ms));
    let Ok(method) = Method::from_bytes(request.method.to_ascii_uppercase().as_bytes()) else {
        return (Head::failed(NetKind::Other, "bad method"), Vec::new(), None);
    };
    let headers = outgoing(&method, &request.headers, request.body.is_some());
    let replayable = matches!(method, Method::GET | Method::HEAD)
        && request.route.as_ref().is_none_or(|route| route.last);
    let hop = Hop {
        url: request.url.clone(),
        tier: request
            .route
            .as_ref()
            .map_or(Tier::Direct, |route| route.tier),
        origin: request
            .route
            .as_ref()
            .map_or_else(String::new, |route| route.origin.clone()),
    };
    let role = Role::of_index(
        request
            .route
            .as_ref()
            .map_or(0, |route| usize::from(route.attempt)),
    );
    let mut stalled = false;
    let (response, flight, answered_in) = loop {
        let client = if stalled { fresh } else { pooled };
        let asked = Instant::now();
        let (builder, flight) = traced::begin(client, method.clone(), &hop, role, "api");
        let flight = if request.long_poll {
            flight.unrecorded()
        } else {
            flight
        };
        let mut builder = builder.headers(headers.clone());
        if let Some(body) = request.body.clone() {
            builder = builder.body(body);
        }
        match within(deadline, builder.send()).await {
            None => {
                suspect(request);
                flight.failed(FailKind::Timeout, "no answer in time");
                return (
                    Head::failed(NetKind::Timeout, "no answer in time"),
                    Vec::new(),
                    None,
                );
            }
            Some(Err(error)) if replayable && !stalled && dropped_by_pings(&error) => {
                flight.failed(FailKind::Timeout, PINGS_GAVE_UP);
                stalled = true;
            }
            Some(Err(error)) => {
                suspect(request);
                let text = described(&error);
                let kind = fail::of_wreq(&error);
                flight.failed(kind, text.clone());
                return (Head::failed(net_kind(kind), text), Vec::new(), None);
            }
            Some(Ok(response)) => {
                let measured = !stalled && !request.long_poll;
                break (response, flight, measured.then(|| asked.elapsed()));
            }
        }
    };
    let status = response.status();
    let head = Head::Answer {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or_default().to_string(),
        headers: incoming(response.headers()),
        url: response.uri().to_string(),
        stalled,
    };
    match read_body(response, deadline).await {
        Ok(body) => {
            flight.answered(status.as_u16(), body.len() as u64);
            (head, body, answered_in)
        }
        Err(message) => {
            flight.cut(FailKind::Body, message.clone(), status.as_u16());
            (
                Head::failed(NetKind::Body, message),
                Vec::new(),
                answered_in,
            )
        }
    }
}

async fn read_body(
    response: wreq::Response,
    deadline: Option<tokio::time::Instant>,
) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    loop {
        let stall_at = tokio::time::Instant::now() + BODY_STALL;
        let until = deadline.map_or(stall_at, |at| at.min(stall_at));
        match tokio::time::timeout_at(until, chunks.next()).await {
            Err(_) if until < stall_at => {
                return Err("timed out while reading the body".to_string());
            }
            Err(_) => return Err("the body stalled".to_string()),
            Ok(Some(Err(error))) => return Err(described(&error)),
            Ok(None) => return Ok(body),
            Ok(Some(Ok(chunk))) => body.extend_from_slice(&chunk),
        }
    }
}

async fn within<F: Future>(deadline: Option<tokio::time::Instant>, work: F) -> Option<F::Output> {
    match deadline {
        Some(at) => tokio::time::timeout_at(at, work).await.ok(),
        None => Some(work.await),
    }
}

fn suspect(request: &FetchRequest) {
    if let Some(host) = host_of(&request.url) {
        dns::suspect(&host);
    }
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

fn dropped_by_pings(error: &wreq::Error) -> bool {
    let mut cause = std::error::Error::source(error);
    while let Some(current) = cause {
        if current.to_string().contains(PINGS_GAVE_UP) {
            return true;
        }
        cause = current.source();
    }
    false
}

fn described(error: &wreq::Error) -> String {
    let mut text = error.to_string();
    if let Some(uri) = error.uri() {
        text = text.replace(&format!(" for uri ({uri})"), "");
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

#[cfg(test)]
#[path = "fetch_h2_tests.rs"]
mod h2_tests;

#[cfg(all(test, target_os = "linux"))]
#[path = "nodelay_tests.rs"]
mod nodelay_tests;
