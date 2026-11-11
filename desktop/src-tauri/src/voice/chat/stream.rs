use std::time::Duration;

use futures_util::StreamExt;
use serde_json::Value;
use tokio::sync::oneshot;
use tokio::time::Instant;
use voice_chat::{ChatEvent, Parser, refusal};
use wreq::Method;
use wreq::header::{ACCEPT, CONTENT_TYPE};

use super::Refused;
use crate::network::edge::{self, Hop, Tier};
use crate::network::fail::FailKind;
use crate::network::netcheck::model::Role;
use crate::network::traced::{self, Flight};

const EVENT_STREAM: &str = "text/event-stream";
const BROKEN: &str = "network";
const UNAVAILABLE: &str = "unavailable";
const REFUSAL_MOST: usize = 4096;

#[derive(Clone, Copy)]
pub struct Patience {
    pub answer: Duration,
    pub hop: Duration,
    pub pro_hop: Duration,
    pub silence: Duration,
}

enum Told {
    Stream(wreq::Response),
    Refused(&'static str),
    Lost,
}

pub async fn exchange(
    client: &wreq::Client,
    urls: &[String],
    token: &str,
    body: &Value,
    patience: Patience,
    cancelled: oneshot::Receiver<()>,
    pass: &(dyn Fn(ChatEvent) + Sync),
) -> Result<(), Refused> {
    let told = async {
        let response = answer(client, urls, token, body, patience).await?;
        relay(response, patience.silence, pass).await;
        Ok(())
    };
    tokio::select! {
        result = told => result,
        _ = cancelled => {
            pass(ChatEvent::Cancelled);
            Ok(())
        }
    }
}

async fn answer(
    client: &wreq::Client,
    urls: &[String],
    token: &str,
    body: &Value,
    patience: Patience,
) -> Result<wreq::Response, Refused> {
    let until = Instant::now() + patience.answer;
    let mut refused = Refused::NETWORK;
    for url in urls {
        for (at, hop) in edge::plan(url).iter().enumerate() {
            let now = Instant::now();
            if now >= until {
                return Err(Refused::NETWORK);
            }
            let limit = until.min(now + patience.of(hop.tier));
            let (request, flight) =
                traced::begin(client, Method::POST, hop, Role::of_index(at), "voice");
            let request = request
                .header("x-session-id", token)
                .header(ACCEPT, EVENT_STREAM)
                .json(body);
            match told(request, flight, hop, limit).await {
                Told::Stream(response) => return Ok(response),
                Told::Refused(UNAVAILABLE) => {
                    refused = Refused { code: UNAVAILABLE };
                    break;
                }
                Told::Refused(code) => return Err(Refused { code }),
                Told::Lost => {}
            }
        }
    }
    Err(refused)
}

async fn told(request: wreq::RequestBuilder, flight: Flight, hop: &Hop, limit: Instant) -> Told {
    let response = match tokio::time::timeout_at(limit, request.send()).await {
        Ok(Ok(response)) => response,
        Ok(Err(error)) => {
            flight.broke(&error);
            hop.note(false);
            return Told::Lost;
        }
        Err(_) => {
            flight.failed(FailKind::Timeout, "no answer in time");
            hop.note(false);
            return Told::Lost;
        }
    };
    let status = response.status();
    let code = status.as_u16();
    let told = if status.is_success() {
        streams(&response).then_some(Told::Stream(response))
    } else {
        refusal(code, &said(response, limit).await).map(Told::Refused)
    };
    match told {
        Some(told) => {
            flight.answered(code, 0);
            hop.note(true);
            told
        }
        None => {
            flight.cut(FailKind::Status, "not the api's answer", code);
            hop.note(false);
            Told::Lost
        }
    }
}

fn streams(response: &wreq::Response) -> bool {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|kind| kind.to_str().ok())
        .is_some_and(|kind| kind.trim_start().starts_with(EVENT_STREAM))
}

async fn said(response: wreq::Response, limit: Instant) -> Vec<u8> {
    let mut said = Vec::new();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    while said.len() <= REFUSAL_MOST {
        match tokio::time::timeout_at(limit, chunks.next()).await {
            Ok(Some(Ok(chunk))) => said.extend_from_slice(&chunk),
            _ => break,
        }
    }
    said
}

async fn relay(response: wreq::Response, silence: Duration, pass: &(dyn Fn(ChatEvent) + Sync)) {
    let mut parser = Parser::default();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    loop {
        let chunk = match tokio::time::timeout(silence, chunks.next()).await {
            Ok(Some(Ok(chunk))) => chunk,
            _ => return pass(ChatEvent::error(BROKEN)),
        };
        for frame in parser.push(&chunk) {
            let Some(event) = ChatEvent::decode(&frame) else {
                continue;
            };
            let last = event.last();
            pass(event);
            if last {
                return;
            }
        }
    }
}

impl Patience {
    fn of(&self, tier: Tier) -> Duration {
        match tier {
            Tier::Direct | Tier::Relay => self.hop,
            Tier::Pro => self.pro_hop,
        }
    }
}
