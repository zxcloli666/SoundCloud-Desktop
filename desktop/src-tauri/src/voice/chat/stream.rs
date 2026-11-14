use std::time::Duration;

use futures_util::StreamExt;
use tokio::sync::oneshot;
use tokio::time::Instant;
use voice_chat::{ChatEvent, Parser, refusal};
use wreq::header::CONTENT_TYPE;

use super::Refused;
use crate::voice::api::{self, Request, Told};

pub const EVENT_STREAM: &str = "text/event-stream";
const BROKEN: &str = "network";
const UNAVAILABLE: &str = "unavailable";

pub async fn exchange(
    request: &Request<'_>,
    silence: Duration,
    cancelled: oneshot::Receiver<()>,
    pass: &(dyn Fn(ChatEvent) + Sync),
) -> Result<(), Refused> {
    let told = async {
        let (response, _) = api::send(request, Refused::NETWORK, judged).await?;
        relay(response, silence, pass).await;
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

async fn judged(response: wreq::Response, limit: Instant) -> Told<wreq::Response, Refused> {
    let status = response.status();
    if status.is_success() {
        return if streams(&response) {
            Told::Took(response)
        } else {
            Told::Lost(None)
        };
    }
    match refusal(status.as_u16(), &api::said(response, limit).await) {
        Some(UNAVAILABLE) => Told::Elsewhere(Refused { code: UNAVAILABLE }),
        Some(code) => Told::Refused(Refused { code }),
        None => Told::Lost(None),
    }
}

fn streams(response: &wreq::Response) -> bool {
    response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|kind| kind.to_str().ok())
        .is_some_and(|kind| kind.trim_start().starts_with(EVENT_STREAM))
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
