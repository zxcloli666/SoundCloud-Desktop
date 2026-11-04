use std::collections::HashMap;
use std::ops::Range;
use std::sync::{Arc, Mutex};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use bytes::Buf;
use futures_util::{Stream, StreamExt};
use serde::Deserialize;
use serde_json::{Value, json};
use warp::Filter;
use warp::http::Response;
use warp::hyper::Body;

const FORGOTTEN: usize = 1024;

type Shared = Arc<Mutex<Relay>>;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Staging,
    Old,
    ForgetsOnce,
    RefusesOpen,
    Vanishes,
    Forwards,
}

#[derive(Deserialize)]
struct Size {
    size: usize,
}

#[derive(Deserialize)]
struct Opening {
    #[serde(default)]
    method: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    headers: Vec<(String, String)>,
    body: Option<String>,
    body_stage: Option<String>,
}

struct Stage {
    bytes: Vec<u8>,
    covered: Vec<Range<usize>>,
}

impl Stage {
    fn write(&mut self, at: usize, chunk: &[u8]) {
        self.bytes[at..at + chunk.len()].copy_from_slice(chunk);
        let mut covered = std::mem::take(&mut self.covered);
        covered.push(at..at + chunk.len());
        self.covered = merged(covered);
    }

    fn forget(&mut self, len: usize) {
        self.covered = self
            .covered
            .iter()
            .map(|range| range.start.max(len)..range.end)
            .filter(|range| range.start < range.end)
            .collect();
    }

    fn missing(&self) -> Vec<[usize; 2]> {
        let mut gaps = Vec::new();
        let mut at = 0;
        for range in &self.covered {
            if range.start > at {
                gaps.push([at, range.start]);
            }
            at = at.max(range.end);
        }
        if at < self.bytes.len() {
            gaps.push([at, self.bytes.len()]);
        }
        gaps
    }

    fn answer(&self, id: &str) -> Value {
        json!({ "id": id, "size": self.bytes.len(), "missing": self.missing() })
    }
}

#[derive(Default)]
struct Relay {
    stages: HashMap<String, Stage>,
    answers: HashMap<String, Vec<u8>>,
    delivered: Vec<Vec<u8>>,
    stages_opened: usize,
    opens: usize,
    parts: usize,
    forgot: bool,
    on_part: Option<Box<dyn FnOnce() + Send>>,
}

impl Relay {
    fn take(&mut self, id: &str, kind: Kind) -> Result<Vec<u8>, u16> {
        let stage = self.stages.get_mut(id).ok_or(404u16)?;
        if kind == Kind::ForgetsOnce && !self.forgot {
            self.forgot = true;
            stage.forget(FORGOTTEN);
        }
        if !stage.missing().is_empty() {
            return Err(409);
        }
        self.stages.remove(id).map(|stage| stage.bytes).ok_or(404)
    }
}

pub struct FakeRelay {
    pub url: String,
    relay: Shared,
}

impl FakeRelay {
    fn read<T>(&self, read: impl FnOnce(&Relay) -> T) -> T {
        read(&self.relay.lock().unwrap())
    }

    pub fn delivered(&self) -> Vec<Vec<u8>> {
        self.read(|relay| relay.delivered.clone())
    }

    pub fn stages_opened(&self) -> usize {
        self.read(|relay| relay.stages_opened)
    }

    pub fn stages_left(&self) -> usize {
        self.read(|relay| relay.stages.len())
    }

    pub fn opens(&self) -> usize {
        self.read(|relay| relay.opens)
    }

    pub fn parts(&self) -> usize {
        self.read(|relay| relay.parts)
    }

    pub fn on_first_part(&self, hook: impl FnOnce() + Send + 'static) {
        self.relay.lock().unwrap().on_part = Some(Box::new(hook));
    }
}

pub fn serve(kind: Kind) -> FakeRelay {
    let relay = Shared::default();
    let shared = {
        let relay = relay.clone();
        warp::any().map(move || relay.clone())
    };
    let create = warp::path!("stage")
        .and(warp::post())
        .and(shared.clone())
        .and(warp::body::json())
        .map(move |relay: Shared, asked: Size| create(&relay, kind, asked.size));
    let put = warp::path!("stage" / String)
        .and(warp::put())
        .and(shared.clone())
        .and(warp::query::<HashMap<String, String>>())
        .and(warp::body::stream())
        .then(move |id, relay, query, body| put(relay, kind, id, query, body));
    let status = warp::path!("stage" / String)
        .and(warp::get())
        .and(shared.clone())
        .map(|id: String, relay: Shared| status(&relay, &id));
    let close = warp::path!("stage" / String)
        .and(warp::delete())
        .and(shared.clone())
        .map(|id: String, relay: Shared| {
            relay.lock().unwrap().stages.remove(&id);
            empty(204)
        });
    let open = warp::path!("open")
        .and(warp::post())
        .and(shared.clone())
        .and(warp::body::json())
        .then(move |relay: Shared, asked: Opening| opened(relay, kind, asked));
    let take = warp::path!("take" / String)
        .and(warp::get())
        .and(shared)
        .and(warp::query::<HashMap<String, String>>())
        .map(|id: String, relay: Shared, asked| piece(&relay, &id, &asked));
    let taken = warp::path!("take" / String)
        .and(warp::delete())
        .map(|_id: String| empty(200));
    let routes = create
        .or(put)
        .or(status)
        .or(close)
        .or(open)
        .or(take)
        .or(taken);
    let (addr, server) = warp::serve(routes).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    FakeRelay {
        url: format!("http://{addr}"),
        relay,
    }
}

fn create(relay: &Shared, kind: Kind, size: usize) -> Response<Body> {
    if kind == Kind::Old {
        return empty(404);
    }
    let mut relay = relay.lock().unwrap();
    relay.stages_opened += 1;
    let id = format!("stage-{}", relay.stages_opened);
    let stage = Stage {
        bytes: vec![0; size],
        covered: Vec::new(),
    };
    let answer = stage.answer(&id);
    relay.stages.insert(id, stage);
    json(answer)
}

async fn put<S, B>(
    relay: Shared,
    kind: Kind,
    id: String,
    query: HashMap<String, String>,
    body: S,
) -> Response<Body>
where
    S: Stream<Item = Result<B, warp::Error>>,
    B: Buf,
{
    if kind == Kind::Old {
        return empty(404);
    }
    if kind == Kind::Vanishes {
        relay.lock().unwrap().stages.clear();
    }
    let hook = {
        let mut relay = relay.lock().unwrap();
        relay.parts += 1;
        relay.on_part.take()
    };
    if let Some(hook) = hook {
        hook();
    }
    let mut at: usize = query.get("at").and_then(|at| at.parse().ok()).unwrap_or(0);
    let mut body = std::pin::pin!(body);
    while let Some(chunk) = body.next().await {
        let Ok(mut chunk) = chunk else {
            return empty(400);
        };
        let bytes = chunk.copy_to_bytes(chunk.remaining());
        let mut relay = relay.lock().unwrap();
        let Some(stage) = relay.stages.get_mut(&id) else {
            return empty(404);
        };
        if at + bytes.len() > stage.bytes.len() {
            return empty(413);
        }
        stage.write(at, &bytes);
        at += bytes.len();
    }
    status(&relay, &id)
}

fn status(relay: &Shared, id: &str) -> Response<Body> {
    match relay.lock().unwrap().stages.get(id) {
        Some(stage) => json(stage.answer(id)),
        None => empty(404),
    }
}

async fn opened(relay: Shared, kind: Kind, asked: Opening) -> Response<Body> {
    if kind != Kind::Forwards {
        return open(&relay, kind, asked);
    }
    let request = forwarded(&asked);
    let body = {
        let mut relay = relay.lock().unwrap();
        relay.opens += 1;
        match carried(&mut relay, kind, asked) {
            Ok(body) => body,
            Err(status) => return empty(status),
        }
    };
    let sent = request.body(body.clone()).send().await;
    let status = sent.map_or(502, |answer| answer.status().as_u16());
    let mut relay = relay.lock().unwrap();
    relay.delivered.push(body);
    answered(&mut relay, status, Vec::new())
}

fn forwarded(asked: &Opening) -> wreq::RequestBuilder {
    let method = wreq::Method::from_bytes(asked.method.as_bytes()).unwrap();
    let mut request = wreq::Client::new().request(method, &asked.url);
    for (name, value) in &asked.headers {
        request = request.header(name, value);
    }
    request
}

fn open(relay: &Shared, kind: Kind, asked: Opening) -> Response<Body> {
    let mut relay = relay.lock().unwrap();
    relay.opens += 1;
    if kind == Kind::RefusesOpen && asked.body_stage.is_some() {
        return empty(429);
    }
    let body = match carried(&mut relay, kind, asked) {
        Ok(body) => body,
        Err(status) => return empty(status),
    };
    relay.delivered.push(body.clone());
    answered(&mut relay, 200, body)
}

fn carried(relay: &mut Relay, kind: Kind, asked: Opening) -> Result<Vec<u8>, u16> {
    let stage = asked.body_stage.filter(|_| kind != Kind::Old);
    match (asked.body, stage) {
        (Some(_), Some(_)) => Err(400),
        (Some(body), None) => BASE64.decode(body).map_err(|_| 400),
        (None, Some(id)) => relay.take(&id, kind),
        (None, None) => Ok(Vec::new()),
    }
}

fn answered(relay: &mut Relay, status: u16, body: Vec<u8>) -> Response<Body> {
    let id = format!("answer-{}", relay.opens);
    let headers = json!([["content-length", body.len().to_string()]]);
    relay.answers.insert(id.clone(), body);
    json(json!({ "id": id, "status": status, "headers": headers }))
}

fn piece(relay: &Shared, id: &str, asked: &HashMap<String, String>) -> Response<Body> {
    let relay = relay.lock().unwrap();
    let Some(whole) = relay.answers.get(id) else {
        return empty(502);
    };
    let at = |name: &str| {
        asked
            .get(name)
            .and_then(|value| value.parse::<usize>().ok())
    };
    let from = at("from").unwrap_or(0).min(whole.len());
    let end = (from + at("max").unwrap_or(0)).min(whole.len());
    Response::builder()
        .header("x-pro-end", if end == whole.len() { "1" } else { "0" })
        .header("x-pro-total", whole.len())
        .body(Body::from(whole[from..end].to_vec()))
        .unwrap()
}

fn merged(mut ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    ranges.sort_by_key(|range| range.start);
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
            _ => merged.push(range),
        }
    }
    merged
}

fn json(value: Value) -> Response<Body> {
    Response::builder()
        .header("content-type", "application/json")
        .body(Body::from(value.to_string()))
        .unwrap()
}

fn empty(status: u16) -> Response<Body> {
    Response::builder()
        .status(status)
        .body(Body::empty())
        .unwrap()
}
