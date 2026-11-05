use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sc_chat::channel::{Channel, InnerAnswer};
use sc_chat::crypto::DeviceKeys;
use sc_chat::sc_chat_wire::ock::OckSecret;
use sc_chat::sc_chat_wire::prost::Message;
use sc_chat::sc_chat_wire::proto::{Header, Inner, InnerResponse};
use sc_chat::sc_chat_wire::seal::{ENC_LEN, open_request};
use sc_chat::{
    ChatResult, Clock, Millis, Tier, Transport, TransportError, TransportRequest,
    TransportResponse, async_trait,
};
use serde_json::json;
use uuid::Uuid;

use super::exchange::{Call, Signer};
use super::lane::Lane;
use super::node::{Node, Nodes};
use super::{LOGIN, get};

pub const NOW: Millis = 1_760_958_000_000;
pub const SESSION: &str = "0192e5c4-7b7e-7a3c-9d55-2b8f3c1e4a10";
pub const REQUEST: &str = "7c0c5f7e-0000-4000-8000-000000000001";

struct FixedClock;

#[async_trait]
impl Clock for FixedClock {
    fn now_ms(&self) -> Millis {
        NOW
    }

    async fn sleep(&self, _ms: u64) {}
}

pub enum Reply {
    Answer(u32, String),
    Forged,
    Down,
    Missing,
}

pub struct Seen {
    pub tier: Tier,
    pub inner: Inner,
    pub enc: [u8; ENC_LEN],
}

pub struct Origin {
    seed: [u8; 32],
    secret: OckSecret,
    tiers: Vec<Tier>,
    script: Mutex<VecDeque<Reply>>,
    seen: Mutex<Vec<Seen>>,
}

impl Origin {
    pub fn new(tiers: Vec<Tier>, script: Vec<Reply>) -> Arc<Self> {
        let seed = sc_chat::sc_chat_wire::random_bytes::<32>().unwrap();
        Self::with_seed(seed, tiers, script)
    }

    pub fn beside(other: &Origin, script: Vec<Reply>) -> Arc<Self> {
        Self::with_seed(other.seed, other.tiers.clone(), script)
    }

    fn with_seed(seed: [u8; 32], tiers: Vec<Tier>, script: Vec<Reply>) -> Arc<Self> {
        Arc::new(Self {
            seed,
            secret: OckSecret::from_bytes(&seed).unwrap(),
            tiers,
            script: Mutex::new(script.into()),
            seen: Mutex::new(Vec::new()),
        })
    }

    pub fn lane(&self) -> Lane {
        let pins = vec![(1, self.secret.public())];
        Lane::with_channel(Channel::with_pins(Arc::new(FixedClock), pins))
    }

    pub fn seen<T>(&self, read: impl FnOnce(&[Seen]) -> T) -> T {
        read(&self.seen.lock().unwrap())
    }
}

#[async_trait]
impl Transport for Origin {
    fn tiers(&self) -> Vec<Tier> {
        self.tiers.clone()
    }

    async fn exchange(
        &self,
        request: TransportRequest,
    ) -> Result<TransportResponse, TransportError> {
        let opened = open_request(&request.envelope, &self.secret).unwrap();
        let inner = Inner::decode(opened.inner.as_slice()).unwrap();
        self.seen.lock().unwrap().push(Seen {
            tier: request.tier,
            inner,
            enc: opened.enc,
        });
        let reply = self.script.lock().unwrap().pop_front().unwrap();
        let (status, body) = match reply {
            Reply::Down => return Err(TransportError::Unreachable),
            Reply::Missing => {
                return Ok(TransportResponse {
                    status: 404,
                    body: Vec::new(),
                    retry_after_ms: None,
                });
            }
            Reply::Forged => return Ok(sealed_body(vec![7; 64])),
            Reply::Answer(status, body) => (status, body),
        };
        let answer = InnerResponse {
            status,
            headers: vec![Header {
                name: "content-type".to_owned(),
                value: "application/json".to_owned(),
            }],
            body: body.into_bytes(),
        };
        let nonce = sc_chat::sc_chat_wire::random_bytes().unwrap();
        let body = opened
            .response_key
            .seal(&opened.enc, nonce, &answer.encode_to_vec())
            .unwrap();
        Ok(sealed_body(body))
    }
}

fn sealed_body(body: Vec<u8>) -> TransportResponse {
    TransportResponse {
        status: 200,
        body,
        retry_after_ms: None,
    }
}

pub fn begun() -> Reply {
    let body =
        json!({ "url": "https://secure.soundcloud.com/authorize", "loginRequestId": REQUEST });
    Reply::Answer(200, body.to_string())
}

pub fn clock(server_now: Option<Millis>) -> Reply {
    let body = match server_now {
        Some(server_now) => json!({ "error": "chat_clock", "server_now": server_now }),
        None => json!({ "error": "chat_clock" }),
    };
    Reply::Answer(401, body.to_string())
}

pub fn required(seed_byte: u8, effort: u32) -> Reply {
    let seed = URL_SAFE_NO_PAD.encode([seed_byte; 32]);
    let body = json!({ "error": "chat_pow_required", "v": 1, "seed": seed, "effort": effort });
    Reply::Answer(429, body.to_string())
}

pub fn switched_off() -> Reply {
    Reply::Answer(503, json!({ "error": "chat_disabled" }).to_string())
}

pub fn signer() -> Signer {
    Signer {
        device_id: Uuid::new_v4(),
        keys: DeviceKeys::generate().unwrap(),
    }
}

pub fn login_call(session: Option<&str>) -> Call {
    Call::new(get(LOGIN, String::new()), session.map(str::to_owned), 8_000)
}

pub fn nodes(main: &Arc<Origin>, star: &Arc<Origin>) -> Nodes {
    Nodes::new(main.clone(), star.clone())
}

pub async fn send_one(
    lane: &Lane,
    origin: &Arc<Origin>,
    signer: &Signer,
    call: &Call,
) -> ChatResult<InnerAnswer> {
    let nodes = nodes(origin, origin);
    let (_, answer) = lane
        .send(&nodes, &[Node::Main], signer, call, &|_| {})
        .await?;
    Ok(answer)
}
