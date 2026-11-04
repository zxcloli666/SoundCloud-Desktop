mod answers;
mod stage;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use bytes::Buf;
use futures_util::{Stream, StreamExt};
use serde::Deserialize;
use serde_json::Value;
use warp::Filter;
use warp::http::Response;
use warp::hyper::Body;

use answers::{Opening, opened, piece};
use stage::Stage;

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
    idle: Option<Duration>,
    failing_opens: usize,
    stage_refusal: Option<u16>,
}

impl Relay {
    fn sweep(&mut self) {
        if let Some(idle) = self.idle {
            self.stages
                .retain(|_, stage| stage.touched.elapsed() < idle);
        }
    }

    fn stage(&mut self, id: &str) -> Option<&mut Stage> {
        self.sweep();
        let stage = self.stages.get_mut(id)?;
        stage.touched = Instant::now();
        Some(stage)
    }

    fn take(&mut self, id: &str, kind: Kind) -> Result<Vec<u8>, u16> {
        let forget = kind == Kind::ForgetsOnce && !self.forgot;
        let stage = self.stage(id).ok_or(404u16)?;
        if forget {
            stage.forget(FORGOTTEN);
        }
        self.forgot |= forget;
        let stage = self.stages.get(id).ok_or(404u16)?;
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

    pub fn idle(&self, idle: Duration) {
        self.relay.lock().unwrap().idle = Some(idle);
    }

    pub fn fail_opens(&self, count: usize) {
        self.relay.lock().unwrap().failing_opens = count;
    }

    pub fn refuse_stages(&self, status: u16) {
        self.relay.lock().unwrap().stage_refusal = Some(status);
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
    if let Some(status) = relay.stage_refusal {
        return empty(status);
    }
    relay.sweep();
    relay.stages_opened += 1;
    let id = format!("stage-{}", relay.stages_opened);
    let stage = Stage::new(size);
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
        let Some(stage) = relay.stage(&id) else {
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
    match relay.lock().unwrap().stage(id) {
        Some(stage) => json(stage.answer(id)),
        None => empty(404),
    }
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
