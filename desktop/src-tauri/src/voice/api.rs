use std::future::Future;
use std::time::Duration;

use futures_util::StreamExt;
use serde_json::Value;
use tokio::time::Instant;
use wreq::Method;
use wreq::header::ACCEPT;

use crate::network::edge::{self, Hop, Tier};
use crate::network::fail::FailKind;
use crate::network::fetch;
use crate::network::netcheck::model::Role;
use crate::network::traced;
use crate::rt::AppHandle;

pub const SESSION: &str = "session";
pub const NETWORK: &str = "network";

const BASES: [&str; 2] = ["api-star", "api"];
const SAID_MOST: usize = 4096;

#[derive(Clone, Copy)]
pub struct Patience {
    pub answer: Duration,
    pub hop: Duration,
    pub pro_hop: Duration,
}

pub struct Request<'a> {
    pub client: &'a wreq::Client,
    pub method: Method,
    pub urls: Vec<String>,
    pub token: String,
    pub accept: &'static str,
    pub body: Option<&'a Value>,
    pub patience: Patience,
}

pub enum Told<T, E> {
    Took(T),
    Refused(E),
    Elsewhere(E),
    Lost(Option<E>),
}

impl<'a> Request<'a> {
    pub async fn post(
        app: &AppHandle,
        path: &str,
        accept: &'static str,
        body: &'a Value,
        patience: Patience,
    ) -> Result<Request<'a>, &'static str> {
        let token = crate::auth::session_token(Some(app)).await.ok_or(SESSION)?;
        let client = fetch::client().ok_or(NETWORK)?;
        let urls = BASES
            .iter()
            .map(|base| format!("https://{}{path}", edge::plain_host(base)))
            .collect();
        Ok(Request {
            client,
            method: Method::POST,
            urls,
            token,
            accept,
            body: Some(body),
            patience,
        })
    }

    pub fn get_at(&self, url: String, patience: Patience) -> Request<'a> {
        Request {
            client: self.client,
            method: Method::GET,
            urls: vec![url],
            token: self.token.clone(),
            accept: self.accept,
            body: None,
            patience,
        }
    }
}

pub async fn send<'r, T, E, F, Fut>(
    request: &'r Request<'_>,
    lost: E,
    judge: F,
) -> Result<(T, &'r str), E>
where
    E: Clone,
    F: Fn(wreq::Response, Instant) -> Fut,
    Fut: Future<Output = Told<T, E>>,
{
    let until = Instant::now() + request.patience.answer;
    let mut failed = lost.clone();
    for url in &request.urls {
        for (at, hop) in edge::plan(url).iter().enumerate() {
            let now = Instant::now();
            if now >= until {
                return Err(lost);
            }
            let limit = until.min(now + request.patience.of(hop.tier));
            match told(request, hop, at, limit, &judge).await {
                Told::Took(answer) => return Ok((answer, url)),
                Told::Refused(refused) => return Err(refused),
                Told::Elsewhere(refused) => {
                    failed = refused;
                    break;
                }
                Told::Lost(Some(why)) => failed = why,
                Told::Lost(None) => {}
            }
        }
    }
    Err(failed)
}

async fn told<T, E, F, Fut>(
    request: &Request<'_>,
    hop: &Hop,
    at: usize,
    limit: Instant,
    judge: &F,
) -> Told<T, E>
where
    F: Fn(wreq::Response, Instant) -> Fut,
    Fut: Future<Output = Told<T, E>>,
{
    let method = request.method.clone();
    let (sent, flight) = traced::begin(request.client, method, hop, Role::of_index(at), "voice");
    let mut sent = sent
        .header("x-session-id", &request.token)
        .header(ACCEPT, request.accept);
    if let Some(body) = request.body {
        sent = sent.json(body);
    }
    let response = match tokio::time::timeout_at(limit, sent.send()).await {
        Ok(Ok(response)) => response,
        Ok(Err(error)) => {
            flight.broke(&error);
            hop.note(false);
            return Told::Lost(None);
        }
        Err(_) => {
            flight.failed(FailKind::Timeout, "no answer in time");
            hop.note(false);
            return Told::Lost(None);
        }
    };
    let code = response.status().as_u16();
    let told = judge(response, limit).await;
    if matches!(told, Told::Lost(_)) {
        flight.cut(FailKind::Status, "not the api's answer", code);
        hop.note(false);
    } else {
        flight.answered(code, 0);
        hop.note(true);
    }
    told
}

pub async fn said(response: wreq::Response, limit: Instant) -> Vec<u8> {
    let mut said = Vec::new();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    while said.len() <= SAID_MOST {
        match tokio::time::timeout_at(limit, chunks.next()).await {
            Ok(Some(Ok(chunk))) => said.extend_from_slice(&chunk),
            _ => break,
        }
    }
    said
}

impl Patience {
    fn of(&self, tier: Tier) -> Duration {
        match tier {
            Tier::Direct | Tier::Relay => self.hop,
            Tier::Pro => self.pro_hop,
        }
    }
}
