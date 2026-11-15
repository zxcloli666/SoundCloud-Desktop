use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Value, json};
use url::Url;

use crate::bundle::tests::{key, keys, sample, signed};
use crate::bundle::{Bundle, Keys};
use crate::card::Card;
use crate::fetch::{Fetch, Request, Response};
use crate::serial::SerialStore;
use crate::session::{self, Env, Session};

pub const NUMBER: &str = "4242424242424242";
pub const CVV: &str = "737";
pub const NOW: i64 = 1_800_000_000;
pub const SG_HOSTS: [&str; 2] = ["proxy-ee.smart-glocal.com", "fp-gw.com"];

pub const REDIRECT: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds?id=1"}}}]}}"#;
pub const REDIRECT_GET: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds?mdOrder=1","method":"get"}}}]}}"#;
pub const REDIRECT_POST: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds","method":"POST"}}}]}}"#;
pub const SUCCEEDED: &str =
    r#"{"payment_session":{"acquiring_payments":[{"status":"succeeded"}]}}"#;
pub const PENDING: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending"}]}}"#;
pub const FAILED: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"failed","error":{"code":"do_not_honor","description":"Card 4242 declined"}}]}}"#;
pub const CAPTURE_TIMEOUT: &str = r#"{"payment_session":{"status":"cancelled","error":{"code":"capture_timeout","description":"The transaction was canceled due to the confirmation timeout"}}}"#;
pub const CANCELLED_BARE: &str = r#"{"payment_session":{"status":"cancelled"}}"#;

pub struct FakeSg {
    pub seen: Mutex<Vec<Request>>,
    payment: &'static str,
    payment_status: u16,
    refuses: Option<(&'static str, u16)>,
}

impl FakeSg {
    pub fn new(payment: &'static str) -> Arc<Self> {
        Self::with_code(payment, 200)
    }

    pub fn with_code(payment: &'static str, payment_status: u16) -> Arc<Self> {
        Arc::new(Self {
            seen: Mutex::new(vec![]),
            payment,
            payment_status,
            refuses: None,
        })
    }

    pub fn refusing(kind: &'static str, status: u16) -> Arc<Self> {
        Arc::new(Self {
            seen: Mutex::new(vec![]),
            payment: PENDING,
            payment_status: 200,
            refuses: Some((kind, status)),
        })
    }

    pub fn paths(&self) -> Vec<String> {
        let seen = self.seen.lock().unwrap();
        seen.iter()
            .map(|request| Url::parse(&request.url).unwrap().path().to_string())
            .collect()
    }
}

impl Fetch for FakeSg {
    fn call(&self, request: Request) -> Response {
        let path = Url::parse(&request.url).unwrap().path().to_string();
        let body = String::from_utf8_lossy(&request.body).to_string();
        self.seen.lock().unwrap().push(request);
        let (status, body) = match path.as_str() {
            "/widget/v1/init" => (200, "{}".to_string()),
            "/cds/v1/tokenize/elements" => {
                let sent: Value = serde_json::from_str(&body).unwrap();
                let kind = sent["card_elements"][0]["type"]
                    .as_str()
                    .unwrap()
                    .to_string();
                match self.refuses {
                    Some((refused, code)) if refused == kind => (
                        code,
                        json!({ "error": { "code": format!("invalid_{kind}") } }).to_string(),
                    ),
                    _ => (
                        200,
                        json!({ "data": { kind.clone(): format!("hash-{kind}") } }).to_string(),
                    ),
                }
            }
            "/widget/v1/payment" => (self.payment_status, self.payment.to_string()),
            _ => (404, "{}".to_string()),
        };
        Response {
            status,
            body: body.into_bytes(),
            error: None,
        }
    }
}

pub fn serials(name: &str) -> SerialStore {
    let dir: PathBuf = std::env::temp_dir().join(format!("pay-card-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("serial");
    let _ = std::fs::remove_file(&path);
    SerialStore::at(path)
}

pub fn real(entry: &str) -> Bundle {
    let text = match entry {
        "bind" => include_str!("../tests/fixtures/bind.json"),
        "token" => include_str!("../tests/fixtures/token.json"),
        "confirm" => include_str!("../tests/fixtures/confirm.json"),
        other => panic!("no fixture {other}"),
    };
    serde_json::from_str(text).unwrap()
}

pub fn real_keys() -> Keys {
    let public = STANDARD.encode(key(7).verifying_key().to_bytes());
    Keys::parse(&format!("test:{public}"))
}

pub fn env() -> Env {
    Env {
        language: "ru-RU".into(),
        tz_offset: -180,
    }
}

pub fn bind_params() -> Value {
    json!({"payment_id": 1, "public_token": "public-token", "widget_name": null})
}

pub fn yuno_params() -> Value {
    json!({"public_api_key": "pk-1", "checkout_session": "cs-1"})
}

pub fn open_real(entry: &str, params: Value, fetch: Arc<dyn Fetch>, name: &str) -> Session {
    session::open(
        real(entry),
        params,
        env(),
        &real_keys(),
        &serials(name),
        NOW,
        fetch,
    )
    .unwrap()
}

pub fn session_with(script: &str, fetch: Arc<dyn Fetch>, name: &str) -> Session {
    let bundle = signed(sample(script, &SG_HOSTS), &key(1));
    session::open(
        bundle,
        bind_params(),
        env(),
        &keys(1),
        &serials(name),
        1_000,
        fetch,
    )
    .unwrap()
}

pub struct FakeYuno {
    pub seen: Mutex<Vec<Request>>,
    status: u16,
    body: Value,
}

impl FakeYuno {
    pub fn new(status: u16, body: Value) -> Arc<Self> {
        Arc::new(Self {
            seen: Mutex::new(vec![]),
            status,
            body,
        })
    }
}

impl Fetch for FakeYuno {
    fn call(&self, request: Request) -> Response {
        self.seen.lock().unwrap().push(request);
        Response {
            status: self.status,
            body: self.body.to_string().into_bytes(),
            error: None,
        }
    }
}

pub fn card() -> Card {
    Card {
        number: NUMBER.into(),
        expiry: "12/28".into(),
        cvv: CVV.into(),
    }
}
