use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};
use url::Url;

use crate::bundle::tests::{key, keys, sample, signed};
use crate::card::Card;
use crate::fetch::{Fetch, Request, Response};
use crate::serial::SerialStore;
use crate::session::{self, BindParams, Params, Session, TokenParams};

pub const BIND_LUA: &str = include_str!("../tests/fixtures/bind.lua");
pub const YUNO_LUA: &str = include_str!("../tests/fixtures/yuno.lua");
pub const YUNO_HOSTS: [&str; 1] = ["api.y.uno"];
pub const NUMBER: &str = "4242424242424242";
pub const CVV: &str = "737";
pub const HOSTS: [&str; 2] = ["proxy-ee.smart-glocal.com", "fp-gw.com"];

pub const REDIRECT: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds?id=1"}}}]}}"#;
pub const REDIRECT_GET: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds?mdOrder=1","method":"get"}}}]}}"#;
pub const REDIRECT_POST: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending","customer_interaction":{"type":"redirect","redirect":{"url":"https://acs.payeko.ru/3ds","method":"POST"}}}]}}"#;
pub const SUCCEEDED: &str =
    r#"{"payment_session":{"acquiring_payments":[{"status":"succeeded"}]}}"#;
pub const PENDING: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"pending"}]}}"#;
pub const FAILED: &str = r#"{"payment_session":{"acquiring_payments":[{"status":"failed"}]}}"#;
pub const CAPTURE_TIMEOUT: &str = r#"{"payment_session":{"status":"cancelled","acquiring_payments":[{"status":"failed","error":{"code":"capture_timeout","description":"The transaction was canceled due to the confirmation timeout"}}]}}"#;
pub const CANCELLED_NO_PAYMENT: &str = r#"{"payment_session":{"status":"cancelled","error":{"code":"capture_timeout","description":"The transaction was canceled due to the confirmation timeout"}}}"#;
pub const CANCELLED_BARE: &str = r#"{"payment_session":{"status":"cancelled"}}"#;

pub struct FakeSg {
    pub seen: Mutex<Vec<Request>>,
    payment: &'static str,
    payment_status: u16,
    statuses: Mutex<VecDeque<(u16, &'static str)>>,
    refuses: Option<(&'static str, u16)>,
}

impl FakeSg {
    pub fn new(payment: &'static str, statuses: &[&'static str]) -> Arc<Self> {
        Self::with_codes(
            payment,
            200,
            &statuses.iter().map(|body| (200, *body)).collect::<Vec<_>>(),
        )
    }

    pub fn with_codes(
        payment: &'static str,
        payment_status: u16,
        statuses: &[(u16, &'static str)],
    ) -> Arc<Self> {
        Arc::new(Self {
            seen: Mutex::new(vec![]),
            payment,
            payment_status,
            statuses: Mutex::new(statuses.iter().copied().collect()),
            refuses: None,
        })
    }

    pub fn refusing(kind: &'static str, status: u16) -> Arc<Self> {
        Arc::new(Self {
            seen: Mutex::new(vec![]),
            payment: PENDING,
            payment_status: 200,
            statuses: Mutex::new(VecDeque::new()),
            refuses: Some((kind, status)),
        })
    }

    pub fn paths(&self) -> Vec<String> {
        let seen = self.seen.lock().unwrap();
        seen.iter()
            .map(|request| Url::parse(&request.url).unwrap().path().to_string())
            .collect()
    }

    pub fn status_calls(&self) -> usize {
        self.paths()
            .iter()
            .filter(|path| path.ends_with("/session/status"))
            .count()
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
            "/widget/v1/session/status" => {
                let mut queue = self.statuses.lock().unwrap();
                let next = if queue.len() > 1 {
                    queue.pop_front()
                } else {
                    queue.front().copied()
                };
                let (code, body) = next.unwrap_or((200, PENDING));
                (code, body.to_string())
            }
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
    let dir: PathBuf =
        std::env::temp_dir().join(format!("boosty-card-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("serial");
    let _ = std::fs::remove_file(&path);
    SerialStore::at(path)
}

pub fn bind_params() -> Params {
    Params::Bind(BindParams {
        public_token: "public-token".into(),
        widget_name: Some("acquiring_widget".into()),
    })
}

pub fn yuno_params() -> Params {
    Params::Token(TokenParams {
        public_api_key: "pk-1".into(),
        checkout_session: "cs-1".into(),
        tz_offset: -180,
        language: "ru-RU".into(),
    })
}

pub fn session_with(script: &str, fetch: Arc<dyn Fetch>, name: &str) -> Session {
    let bundle = signed(sample(script, &HOSTS), &key(1));
    session::open(
        bundle,
        bind_params(),
        &keys(1),
        &serials(name),
        1_000,
        fetch,
    )
    .unwrap()
}

pub fn yuno_session(fetch: Arc<FakeYuno>, name: &str) -> Session {
    let mut bundle = sample(YUNO_LUA, &YUNO_HOSTS);
    bundle.entry = "token".into();
    let bundle = signed(bundle, &key(1));
    session::open(
        bundle,
        yuno_params(),
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

pub fn session(fetch: Arc<FakeSg>, name: &str) -> Session {
    session_with(BIND_LUA, fetch, name)
}

pub fn card() -> Card {
    Card {
        number: NUMBER.into(),
        expiry: "12/28".into(),
        cvv: CVV.into(),
    }
}
