use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use sc_chat::api::{CallOptions, Exchange, Signer};
use sc_chat::channel::{InnerAnswer, InnerCall};
use sc_chat::{
    ChatResult, Tier, Transport, TransportError, TransportRequest, TransportResponse, async_trait,
};
use serde_json::{Value, json};
use uuid::Uuid;
use warp::Filter;
use warp::http::StatusCode;

#[derive(Default)]
pub struct State {
    pub objects: HashMap<Uuid, Vec<u8>>,
    pub tokens: HashMap<String, Uuid>,
    pub gone: HashMap<Uuid, &'static str>,
    pub expires_in_s: u32,
    pub urls_calls: Vec<Vec<Uuid>>,
    pub gets: Vec<Uuid>,
    pub tampered_gets: usize,
    pub tamper_all: HashSet<Uuid>,
    pub urls_status: Option<(u16, Value)>,
    pub denied: HashSet<Uuid>,
}

pub struct World {
    pub s3: String,
    pub tampering: String,
    pub dead: String,
    pub state: Arc<Mutex<State>>,
}

impl World {
    pub fn start() -> Arc<Self> {
        let state = Arc::new(Mutex::new(State {
            expires_in_s: 900,
            ..State::default()
        }));
        Arc::new(Self {
            s3: serve(state.clone(), false),
            tampering: serve(state.clone(), true),
            dead: dead_origin(),
            state,
        })
    }

    pub fn with<T>(&self, read: impl FnOnce(&mut State) -> T) -> T {
        read(&mut self.state.lock().unwrap())
    }

    pub fn store(&self, id: Uuid, bytes: Vec<u8>) {
        self.with(|state| state.objects.insert(id, bytes));
    }

    pub fn gets_of(&self, id: Uuid) -> usize {
        self.with(|state| state.gets.iter().filter(|got| **got == id).count())
    }

    pub fn urls_calls(&self) -> Vec<Vec<Uuid>> {
        self.with(|state| state.urls_calls.clone())
    }

    fn urls(&self, body: &Value) -> (u16, Value) {
        let ids: Vec<Uuid> = serde_json::from_value(body["ids"].clone()).unwrap_or_default();
        let mut state = self.state.lock().unwrap();
        state.urls_calls.push(ids.clone());
        if let Some(refusal) = state.urls_status.clone() {
            return refusal;
        }
        let conversation = body["conversation_id"]
            .as_str()
            .and_then(|raw| Uuid::parse_str(raw).ok());
        if conversation.is_some_and(|conversation| state.denied.contains(&conversation)) {
            return (403, json!({"error": "chat_not_member"}));
        }
        let items = ids
            .iter()
            .map(|id| match state.gone.get(id) {
                Some(gone) => json!({"state": gone, "id": id}),
                None => {
                    let token = Uuid::new_v4().simple().to_string();
                    state.tokens.insert(token.clone(), *id);
                    let url = format!("{}/scd-chat/{id}?X-Amz-Signature={token}", self.s3);
                    json!({"state": "ok", "id": id, "url": url})
                }
            })
            .collect::<Vec<_>>();
        (
            200,
            json!({"expires_in_s": state.expires_in_s, "items": items}),
        )
    }
}

fn serve(state: Arc<Mutex<State>>, tamper: bool) -> String {
    let shared = warp::any().map(move || state.clone());
    let route = warp::get()
        .and(warp::path!("scd-chat" / Uuid))
        .and(warp::query::<HashMap<String, String>>())
        .and(shared)
        .map(move |id, query, state| object(id, query, state, tamper));
    let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    format!("http://{addr}")
}

fn object(
    id: Uuid,
    query: HashMap<String, String>,
    state: Arc<Mutex<State>>,
    tamper: bool,
) -> warp::http::Response<Vec<u8>> {
    let mut state = state.lock().unwrap();
    let token = query.get("X-Amz-Signature").cloned().unwrap_or_default();
    if state.tokens.get(&token) != Some(&id) {
        return status(StatusCode::FORBIDDEN);
    }
    state.gets.push(id);
    let Some(mut bytes) = state.objects.get(&id).cloned() else {
        return status(StatusCode::NOT_FOUND);
    };
    if tamper || state.tamper_all.contains(&id) {
        state.tampered_gets += 1;
        let last = bytes.len() - 1;
        bytes[last] ^= 0x5a;
    }
    warp::http::Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/octet-stream")
        .body(bytes)
        .unwrap()
}

fn status(code: StatusCode) -> warp::http::Response<Vec<u8>> {
    warp::http::Response::builder()
        .status(code)
        .header("content-type", "application/xml")
        .body(b"<Error/>".to_vec())
        .unwrap()
}

fn dead_origin() -> String {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    format!("http://{addr}")
}

pub struct Api(pub Arc<World>);

#[async_trait]
impl Transport for Api {
    fn tiers(&self) -> Vec<Tier> {
        vec![Tier::Relay]
    }

    async fn exchange(
        &self,
        _request: TransportRequest,
    ) -> Result<TransportResponse, TransportError> {
        Err(TransportError::Unreachable)
    }
}

#[async_trait]
impl Exchange for Api {
    async fn exchange(
        &self,
        call: &InnerCall,
        _signer: &Signer,
        _tier: Tier,
        _options: &CallOptions,
    ) -> ChatResult<InnerAnswer> {
        let body: Value = serde_json::from_slice(&call.body).unwrap_or(Value::Null);
        let (status, answer) = match (call.method.as_str(), call.path.as_str()) {
            ("POST", "/chat/media/urls") => self.0.urls(&body),
            _ => (404, json!({"error": "chat_not_found"})),
        };
        Ok(InnerAnswer {
            status,
            headers: Vec::new(),
            body: serde_json::to_vec(&answer).unwrap(),
        })
    }
}
