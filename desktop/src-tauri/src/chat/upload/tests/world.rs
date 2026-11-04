use std::collections::{HashMap, VecDeque};
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
use warp::hyper::body::Bytes;

#[derive(Clone)]
pub struct Reservation {
    pub upload_id: Uuid,
    pub image: Uuid,
    pub thumb: Option<Uuid>,
    pub image_len: u64,
    pub thumb_len: u64,
    pub committed: bool,
}

#[derive(Default)]
pub struct State {
    pub reservations: Vec<Reservation>,
    pub tokens: HashMap<String, (Uuid, u64)>,
    pub objects: HashMap<Uuid, Vec<u8>>,
    pub puts: Vec<Uuid>,
    pub chunked_puts: usize,
    pub reserves: Vec<Uuid>,
    pub commits: Vec<Uuid>,
    pub deleted: Vec<Uuid>,
    pub refusals: VecDeque<Option<(u16, Value)>>,
    pub expire_puts: usize,
    pub lose_thumbs: usize,
    pub expires_in_s: u32,
    pub calls: Vec<String>,
    pub forbidden: usize,
    pub settings: Vec<(String, Value)>,
    pub settings_refusal: Option<(u16, Value)>,
    pub reports: Vec<Value>,
}

pub struct World {
    pub s3: String,
    pub state: Arc<Mutex<State>>,
}

impl World {
    pub fn start() -> Arc<Self> {
        let state = Arc::new(Mutex::new(State {
            expires_in_s: 600,
            ..State::default()
        }));
        let s3 = serve_s3(state.clone());
        Arc::new(Self { s3, state })
    }

    pub fn with<T>(&self, read: impl FnOnce(&mut State) -> T) -> T {
        read(&mut self.state.lock().unwrap())
    }

    pub fn refuse(&self, status: u16, body: Value) {
        self.with(|state| state.refusals.push_back(Some((status, body))));
    }

    pub fn pass(&self) {
        self.with(|state| state.refusals.push_back(None));
    }

    pub fn reservation(&self, upload_id: Uuid) -> Option<Reservation> {
        self.with(|state| {
            state
                .reservations
                .iter()
                .find(|found| found.upload_id == upload_id)
                .cloned()
        })
    }

    pub fn puts_of(&self, object: Uuid) -> usize {
        self.with(|state| state.puts.iter().filter(|put| **put == object).count())
    }

    pub fn object(&self, object: Uuid) -> Option<Vec<u8>> {
        self.with(|state| state.objects.get(&object).cloned())
    }

    fn answer(&self, call: &InnerCall) -> (u16, Value) {
        let body: Value = serde_json::from_slice(&call.body).unwrap_or(Value::Null);
        let route = format!("{} {}", call.method, call.path);
        self.with(|state| state.calls.push(route.clone()));
        if route == "POST /chat/media/reserve" {
            return self.reserve(&body);
        }
        if route == "POST /chat/media/delete" {
            return self.delete(&body);
        }
        if route == "POST /chat/reports" {
            self.with(|state| state.reports.push(body));
            return (200, json!({"id": Uuid::new_v4(), "state": "open"}));
        }
        if let Some(code) = route
            .strip_prefix("PUT /chat/rooms/")
            .and_then(|rest| rest.strip_suffix("/settings"))
        {
            return self.with(|state| {
                state.settings.push((code.to_string(), body));
                state.settings_refusal.take().unwrap_or((200, json!({})))
            });
        }
        if let Some(id) = route
            .strip_prefix("POST /chat/media/")
            .and_then(|rest| rest.strip_suffix("/commit"))
        {
            return self.commit(Uuid::parse_str(id).unwrap());
        }
        (404, json!({"error": "chat_not_found"}))
    }

    fn reserve(&self, body: &Value) -> (u16, Value) {
        let upload_id = Uuid::parse_str(body["upload_id"].as_str().unwrap()).unwrap();
        let mut state = self.state.lock().unwrap();
        state.reserves.push(upload_id);
        if let Some(Some(refusal)) = state.refusals.pop_front() {
            return refusal;
        }
        let image_len = body["bytes"].as_u64().unwrap();
        let thumb_len = body["thumb_bytes"].as_u64();
        let found = state
            .reservations
            .iter()
            .position(|found| found.upload_id == upload_id && !found.committed);
        let reservation = match found {
            Some(at) => state.reservations[at].clone(),
            None => {
                let made = Reservation {
                    upload_id,
                    image: Uuid::new_v4(),
                    thumb: thumb_len.map(|_| Uuid::new_v4()),
                    image_len,
                    thumb_len: thumb_len.unwrap_or(0),
                    committed: false,
                };
                state.reservations.push(made.clone());
                made
            }
        };
        let image = put(&self.s3, &mut state, reservation.image, image_len);
        let thumb = reservation.thumb.map(|thumb| {
            json!({"id": thumb, "put": put(&self.s3, &mut state, thumb, reservation.thumb_len)})
        });
        let mut answer = json!({
            "id": reservation.image,
            "put": image,
            "expires_in_s": state.expires_in_s,
            "used": 0,
            "quota": 1_073_741_824u64,
        });
        if let Some(thumb) = thumb {
            answer["thumb"] = thumb;
        }
        (200, answer)
    }

    fn commit(&self, image: Uuid) -> (u16, Value) {
        let mut state = self.state.lock().unwrap();
        state.commits.push(image);
        let Some(at) = state
            .reservations
            .iter()
            .position(|found| found.image == image)
        else {
            return (404, json!({"error": "chat_not_found"}));
        };
        let reservation = state.reservations[at].clone();
        if state.lose_thumbs > 0
            && let Some(thumb) = reservation.thumb
        {
            state.lose_thumbs -= 1;
            state.objects.remove(&thumb);
        }
        let fits = |id: Uuid, len: u64| {
            state
                .objects
                .get(&id)
                .is_some_and(|bytes| bytes.len() as u64 == len)
        };
        let mut missing = Vec::new();
        if !fits(reservation.image, reservation.image_len) {
            missing.push(reservation.image);
        }
        if let Some(thumb) = reservation.thumb
            && !fits(thumb, reservation.thumb_len)
        {
            missing.push(thumb);
        }
        if !missing.is_empty() {
            return (409, json!({"error": "chat_media_missing", "ids": missing}));
        }
        state.reservations[at].committed = true;
        let bytes = reservation.image_len + reservation.thumb_len;
        (
            200,
            json!({"id": image, "bytes": bytes, "used": bytes, "quota": 1_073_741_824u64}),
        )
    }

    fn delete(&self, body: &Value) -> (u16, Value) {
        let ids: Vec<Uuid> = serde_json::from_value(body["ids"].clone()).unwrap_or_default();
        let count = ids.len();
        self.with(|state| state.deleted.extend(ids));
        (
            200,
            json!({"deleted": count, "freed": 0, "used": 0, "quota": 1_073_741_824u64}),
        )
    }
}

fn put(s3: &str, state: &mut State, object: Uuid, len: u64) -> Value {
    let token = Uuid::new_v4().simple().to_string();
    state.tokens.retain(|_, (signed, _)| *signed != object);
    state.tokens.insert(token.clone(), (object, len));
    json!({
        "url": format!("{s3}/scd-chat/{object}?X-Amz-Signature={token}"),
        "headers": {"content-length": len.to_string(), "content-type": "application/octet-stream"},
    })
}

fn serve_s3(state: Arc<Mutex<State>>) -> String {
    let shared = warp::any().map(move || state.clone());
    let route = warp::put()
        .and(warp::path!("scd-chat" / Uuid))
        .and(warp::query::<HashMap<String, String>>())
        .and(warp::header::optional::<u64>("content-length"))
        .and(warp::header::optional::<String>("transfer-encoding"))
        .and(warp::body::bytes())
        .and(shared)
        .map(stored);
    let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    format!("http://{addr}")
}

fn stored(
    object: Uuid,
    query: HashMap<String, String>,
    length: Option<u64>,
    chunked: Option<String>,
    body: Bytes,
    state: Arc<Mutex<State>>,
) -> StatusCode {
    let mut state = state.lock().unwrap();
    if chunked.is_some() {
        state.chunked_puts += 1;
    }
    let token = query.get("X-Amz-Signature").cloned().unwrap_or_default();
    let Some((signed, len)) = state.tokens.get(&token).copied() else {
        state.forbidden += 1;
        return StatusCode::FORBIDDEN;
    };
    if state.expire_puts > 0 {
        state.expire_puts -= 1;
        state.forbidden += 1;
        return StatusCode::FORBIDDEN;
    }
    if signed != object || length != Some(len) || body.len() as u64 != len {
        return StatusCode::BAD_REQUEST;
    }
    state.objects.insert(object, body.to_vec());
    state.puts.push(object);
    state.calls.push(format!("PUT {object}"));
    StatusCode::OK
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
        let (status, body) = self.0.answer(call);
        Ok(InnerAnswer {
            status,
            headers: Vec::new(),
            body: serde_json::to_vec(&body).unwrap(),
        })
    }
}
