use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sc_chat::channel::Channel;
use sc_chat::crypto::DeviceKeys;
use sc_chat::sc_chat_wire::bind::verify_bind;
use sc_chat::sc_chat_wire::ock::OckSecret;
use sc_chat::sc_chat_wire::prost::Message;
use sc_chat::sc_chat_wire::proto::{Header, Inner, InnerResponse};
use sc_chat::sc_chat_wire::seal::{ENC_LEN, open_request};
use sc_chat::sc_chat_wire::sign::verify_request;
use sc_chat::{
    ChatError, ChatResult, Clock, KeyName, KeyStorage, KeyStore, LoginBegin, Millis, Tier,
    Transport, TransportError, TransportRequest, TransportResponse, Zeroizing, async_trait,
};
use serde_json::json;
use uuid::Uuid;

use super::exchange::{Call, Signer};
use super::lane::Lane;
use super::{LINK_CLAIM, LOGIN, LOGIN_STATUS, claim_call, get, wire};

const NOW: Millis = 1_760_958_000_000;
const SESSION: &str = "0192e5c4-7b7e-7a3c-9d55-2b8f3c1e4a10";
const REQUEST: &str = "7c0c5f7e-0000-4000-8000-000000000001";

struct FixedClock;

#[async_trait]
impl Clock for FixedClock {
    fn now_ms(&self) -> Millis {
        NOW
    }

    async fn sleep(&self, _ms: u64) {}
}

enum Reply {
    Answer(u32, String),
    Forged,
    Down,
}

struct Seen {
    tier: Tier,
    inner: Inner,
    enc: [u8; ENC_LEN],
}

struct Origin {
    secret: OckSecret,
    tiers: Vec<Tier>,
    script: Mutex<VecDeque<Reply>>,
    seen: Mutex<Vec<Seen>>,
}

impl Origin {
    fn new(tiers: Vec<Tier>, script: Vec<Reply>) -> Self {
        let seed = sc_chat::sc_chat_wire::random_bytes::<32>().unwrap();
        Self {
            secret: OckSecret::from_bytes(&seed).unwrap(),
            tiers,
            script: Mutex::new(script.into()),
            seen: Mutex::new(Vec::new()),
        }
    }

    fn lane(&self) -> Lane {
        let pins = vec![(1, self.secret.public())];
        Lane::with_channel(Channel::with_pins(Arc::new(FixedClock), pins))
    }

    fn seen<T>(&self, read: impl FnOnce(&[Seen]) -> T) -> T {
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

fn begun() -> Reply {
    let body =
        json!({ "url": "https://secure.soundcloud.com/authorize", "loginRequestId": REQUEST });
    Reply::Answer(200, body.to_string())
}

fn clock(server_now: Option<Millis>) -> Reply {
    let body = match server_now {
        Some(server_now) => json!({ "error": "chat_clock", "server_now": server_now }),
        None => json!({ "error": "chat_clock" }),
    };
    Reply::Answer(401, body.to_string())
}

fn signer() -> Signer {
    Signer {
        device_id: Uuid::new_v4(),
        keys: DeviceKeys::generate().unwrap(),
    }
}

fn login_call(session: Option<&str>) -> Call {
    Call::new(get(LOGIN, String::new()), session.map(str::to_owned), 8_000)
}

#[tokio::test]
async fn a_relogin_binds_this_device_to_the_current_session() {
    let origin = Origin::new(vec![Tier::Direct], vec![begun()]);
    let signer = signer();
    let answer = origin
        .lane()
        .send(&origin, &signer, &login_call(Some(SESSION)))
        .await
        .unwrap();
    let begun: LoginBegin = wire::decode(&answer).unwrap();
    assert_eq!(begun.login_request_id, REQUEST);

    origin.seen(|seen| {
        let inner = &seen[0].inner;
        let bind = inner.bind.as_ref().unwrap();
        verify_bind(bind).unwrap();
        verify_request(&bind.auth_pub, inner, &seen[0].enc).unwrap();
        assert_eq!(bind.device_id, signer.device_id.to_string());
        assert_eq!(bind.auth_pub, signer.keys.auth_public());
        assert_eq!(bind.box_pub, signer.keys.box_public().unwrap());
        assert_eq!(inner.session_id.as_deref(), Some(SESSION));
        assert_eq!(inner.device_id, None);
        assert_eq!(inner.path, LOGIN);
    });
}

#[tokio::test]
async fn a_clock_answer_is_sent_again_once_with_the_server_time() {
    let ahead = NOW + 600_000;
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay],
        vec![clock(Some(ahead)), begun()],
    );
    let answer = origin
        .lane()
        .send(&origin, &signer(), &login_call(None))
        .await
        .unwrap();
    assert!(wire::decode::<LoginBegin>(&answer).is_ok());

    origin.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert!(seen.iter().all(|sent| sent.tier == Tier::Direct));
        assert_eq!(seen[0].inner.ts_ms, NOW as u64);
        assert_eq!(seen[1].inner.ts_ms, ahead as u64);
        assert_ne!(seen[0].enc, seen[1].enc);
    });
}

#[tokio::test]
async fn a_clock_answer_without_server_time_keeps_the_clock() {
    let origin = Origin::new(vec![Tier::Direct], vec![clock(None), begun()]);
    let lane = origin.lane();
    let signer = signer();
    let first = lane
        .send(&origin, &signer, &login_call(None))
        .await
        .unwrap();
    assert_eq!(
        wire::decode::<LoginBegin>(&first),
        Err(ChatError::Clock { server_now: 0 })
    );
    lane.send(&origin, &signer, &login_call(None))
        .await
        .unwrap();

    origin.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert_eq!(seen[1].inner.ts_ms, NOW as u64);
    });
}

#[tokio::test]
async fn a_forged_answer_moves_on_and_the_tier_that_answered_leads() {
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay, Tier::Pro],
        vec![Reply::Forged, Reply::Down, begun(), begun()],
    );
    let lane = origin.lane();
    let signer = signer();
    lane.send(&origin, &signer, &login_call(None))
        .await
        .unwrap();
    let status = Call::new(get(LOGIN_STATUS, format!("id={REQUEST}")), None, 10_000);
    lane.send(&origin, &signer, &status).await.unwrap();

    origin.seen(|seen| {
        let tiers: Vec<Tier> = seen.iter().map(|sent| sent.tier).collect();
        assert_eq!(tiers, [Tier::Direct, Tier::Relay, Tier::Pro, Tier::Pro]);
        let first = seen[0].inner.bind.as_ref().unwrap();
        let last = seen[3].inner.bind.as_ref().unwrap();
        assert_eq!(first.auth_pub, last.auth_pub);
        assert_eq!(seen[3].inner.query, format!("id={REQUEST}"));
    });
}

#[tokio::test]
async fn every_tier_down_leaves_the_plain_flow() {
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay],
        vec![Reply::Down, Reply::Forged],
    );
    let result = origin
        .lane()
        .send(&origin, &signer(), &login_call(None))
        .await;
    assert_eq!(result.unwrap_err(), ChatError::Crypto);
}

#[derive(Default)]
struct SlowKeys(Mutex<HashMap<KeyName, Vec<u8>>>);

impl KeyStore for SlowKeys {
    fn storage(&self) -> KeyStorage {
        KeyStorage::File
    }

    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        Ok(self
            .0
            .lock()
            .unwrap()
            .get(&name)
            .cloned()
            .map(Zeroizing::new))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        std::thread::sleep(Duration::from_millis(20));
        self.0.lock().unwrap().insert(name, secret.to_vec());
        Ok(())
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        self.0.lock().unwrap().remove(&name);
        Ok(())
    }
}

#[tokio::test]
async fn two_flows_at_first_start_share_one_device() {
    let lane = Lane::new();
    let store: Arc<dyn KeyStore> = Arc::new(SlowKeys::default());
    let (login, link) = tokio::join!(lane.signer(store.clone()), lane.signer(store.clone()));
    let (login, link) = (login.unwrap(), link.unwrap());
    assert_eq!(login.device_id, link.device_id);
    assert_eq!(login.keys.auth_public(), link.keys.auth_public());
    let (stored_id, stored) = DeviceKeys::load_or_create(store.as_ref()).unwrap();
    assert_eq!(stored_id, login.device_id);
    assert_eq!(stored.box_public(), login.keys.box_public());
}

#[tokio::test]
async fn a_pull_claim_from_the_source_is_sealed_with_its_session() {
    let claimed = json!({ "sessionId": SESSION, "mode": "pull" });
    let origin = Origin::new(
        vec![Tier::Direct],
        vec![Reply::Answer(200, claimed.to_string())],
    );
    let signer = signer();
    let answer = origin
        .lane()
        .send(
            &origin,
            &signer,
            &claim_call("claim-7", Some(SESSION.to_owned())),
        )
        .await
        .unwrap();
    let claimed: sc_chat::LinkClaimed = wire::decode(&answer).unwrap();
    assert_eq!(claimed.mode, sc_chat::LinkMode::Pull);

    origin.seen(|seen| {
        let inner = &seen[0].inner;
        let bind = inner.bind.as_ref().unwrap();
        verify_request(&bind.auth_pub, inner, &seen[0].enc).unwrap();
        assert_eq!(inner.method, "POST");
        assert_eq!(inner.path, LINK_CLAIM);
        assert_eq!(inner.session_id.as_deref(), Some(SESSION));
        let body: serde_json::Value = serde_json::from_slice(&inner.body).unwrap();
        assert_eq!(body["claimToken"], "claim-7");
    });
}
