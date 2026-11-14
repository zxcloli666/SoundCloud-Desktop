use futures_util::StreamExt;
use serde_json::Value;
use tokio::time::Instant;
use voice_engine::Clip;

use crate::voice::api::{self, Told};

const WAV_MOST: usize = 32 << 20;

pub enum Made {
    Clip(Clip),
    Ticket(String),
}

pub async fn judged<T>(
    response: wreq::Response,
    limit: Instant,
    decide: fn(u16, &[u8]) -> Told<T, String>,
) -> Told<T, String> {
    let status = response.status().as_u16();
    if status != 200 {
        return decide(status, &api::said(response, limit).await);
    }
    match wav(response, limit).await {
        Some(wav) => decide(status, &wav),
        None => Told::Lost(None),
    }
}

pub fn posted(status: u16, body: &[u8]) -> Told<Made, String> {
    match status {
        200 => clip(status, body, Made::Clip),
        202 => match ticket(body) {
            Some(ticket) => Told::Took(Made::Ticket(ticket)),
            None => stranger(status),
        },
        _ => refused(status, body),
    }
}

pub fn polled(status: u16, body: &[u8]) -> Told<Option<Clip>, String> {
    match status {
        200 => clip(status, body, Some),
        204 => Told::Took(None),
        _ => refused(status, body),
    }
}

fn clip<T>(status: u16, body: &[u8], took: fn(Clip) -> T) -> Told<T, String> {
    match Clip::from_wav(body) {
        Ok(clip) => Told::Took(took(clip)),
        Err(_) => stranger(status),
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

async fn wav(response: wreq::Response, limit: Instant) -> Option<Vec<u8>> {
    let mut wav = Vec::new();
    let mut chunks = std::pin::pin!(response.bytes_stream());
    loop {
        match tokio::time::timeout_at(limit, chunks.next()).await {
            Ok(Some(Ok(chunk))) if wav.len() + chunk.len() <= WAV_MOST => {
                wav.extend_from_slice(&chunk)
            }
            Ok(None) => return Some(wav),
            _ => return None,
        }
    }
}
