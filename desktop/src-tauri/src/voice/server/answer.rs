use futures_util::StreamExt;
use serde_json::Value;
use tokio::time::Instant;
use voice_engine::Said;

use super::opus;
use crate::voice::api::{self, Told};

pub const CLIP_MOST: usize = 2 << 20;
pub const REVISION: &str = "x-voice-revision";
const REVISION_MOST: usize = 64;

pub enum Made {
    Clip(Said),
    Ticket(String),
}

pub async fn judged<T>(
    response: wreq::Response,
    limit: Instant,
    decide: fn(u16, &[u8], Option<String>) -> Told<T, String>,
) -> Told<T, String> {
    let status = response.status().as_u16();
    let revision = revision(&response);
    if status != 200 {
        return decide(status, &api::said(response, limit).await, revision);
    }
    match whole(response, limit).await {
        Some(body) => decide(status, &body, revision),
        None => Told::Lost(None),
    }
}

fn revision(response: &wreq::Response) -> Option<String> {
    let named = response.headers().get(REVISION)?.to_str().ok()?;
    (!named.is_empty() && named.len() <= REVISION_MOST).then(|| named.to_string())
}

pub fn posted(status: u16, body: &[u8], revision: Option<String>) -> Told<Made, String> {
    match status {
        200 => clip(body, revision, Made::Clip),
        202 => match ticket(body) {
            Some(ticket) => Told::Took(Made::Ticket(ticket)),
            None => stranger(status),
        },
        _ => refused(status, body),
    }
}

pub fn polled(status: u16, body: &[u8], revision: Option<String>) -> Told<Option<Said>, String> {
    match status {
        200 => clip(body, revision, Some),
        204 => Told::Took(None),
        _ => refused(status, body),
    }
}

fn clip<T>(body: &[u8], revision: Option<String>, took: fn(Said) -> T) -> Told<T, String> {
    let clip = if body.len() > CLIP_MOST {
        Err(format!("over {CLIP_MOST} bytes"))
    } else {
        opus::clip(body)
    };
    match clip {
        Ok(clip) => Told::Took(took(Said { clip, revision })),
        Err(why) => Told::Lost(Some(format!("bad_clip: {why}"))),
    }
}

fn ticket(body: &[u8]) -> Option<String> {
    let plain = |c: char| c.is_ascii_alphanumeric() || c == '-' || c == '_';
    field(body, "id").filter(|id| !id.is_empty() && id.chars().all(plain))
}

fn refused<T>(status: u16, body: &[u8]) -> Told<T, String> {
    match field(body, "code") {
        Some(code) if status >= 500 => Told::Elsewhere(code),
        Some(code) => Told::Refused(code),
        None => stranger(status),
    }
}

fn field(body: &[u8], name: &str) -> Option<String> {
    let said: Value = serde_json::from_slice(body).ok()?;
    Some(said.get(name)?.as_str()?.to_string())
}

fn stranger<T>(status: u16) -> Told<T, String> {
    Told::Lost(Some(format!("http_{status}")))
}

async fn whole(response: wreq::Response, limit: Instant) -> Option<Vec<u8>> {
    let mut body = Vec::new();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    while body.len() <= CLIP_MOST {
        match tokio::time::timeout_at(limit, chunks.next()).await {
            Ok(Some(Ok(chunk))) => body.extend_from_slice(&chunk),
            Ok(None) => return Some(body),
            _ => return None,
        }
    }
    Some(body)
}
