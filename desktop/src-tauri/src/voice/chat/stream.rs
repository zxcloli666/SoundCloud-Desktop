use std::time::Duration;

use futures_util::StreamExt;
use serde_json::Value;
use tokio::sync::oneshot;
use tokio::time::Instant;
use voice_chat::{ChatEvent, Parser, refusal};
use wreq::Method;
use wreq::header::ACCEPT;

use super::Refused;
use crate::network::edge;
use crate::network::fail::FailKind;
use crate::network::netcheck::model::Role;
use crate::network::traced;

const EVENT_STREAM: &str = "text/event-stream";
const BROKEN: &str = "network";

#[derive(Clone, Copy)]
pub struct Patience {
    pub answer: Duration,
    pub silence: Duration,
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
        let response = answer(client, urls, token, body, patience.answer).await?;
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
    patience: Duration,
) -> Result<wreq::Response, Refused> {
    let until = Instant::now() + patience;
    let mut refused = Refused::NETWORK;
    for url in urls {
        for (at, hop) in edge::plan(url).iter().enumerate() {
            let (request, flight) =
                traced::begin(client, Method::POST, hop, Role::of_index(at), "voice");
            let request = request
                .header("x-session-id", token)
                .header(ACCEPT, EVENT_STREAM)
                .json(body);
            let response = match tokio::time::timeout_at(until, request.send()).await {
                Ok(Ok(response)) => response,
                Ok(Err(error)) => {
                    flight.broke(&error);
                    hop.note(false);
                    continue;
                }
                Err(_) => {
                    flight.failed(FailKind::Timeout, "no answer in time");
                    hop.note(false);
                    return Err(Refused::NETWORK);
                }
            };
            let status = response.status();
            flight.answered(status.as_u16(), 0);
            if !edge::hop_ok(hop, &response) {
                continue;
            }
            hop.note(true);
            if status.is_success() {
                return Ok(response);
            }
            refused = Refused {
                code: refusal(status.as_u16()),
            };
            if status.is_client_error() {
                return Err(refused);
            }
            break;
        }
    }
    Err(refused)
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
