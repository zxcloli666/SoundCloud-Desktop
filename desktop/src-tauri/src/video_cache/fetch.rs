use std::path::Path;
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;
use wreq::{Client, Method, Response};

use super::progress::{Meter, Progress};
use crate::network::edge::{self, Hop};
use crate::network::fail::Fail;
use crate::network::netcheck::model::Role;
use crate::network::relay_speed;
use crate::network::traced;

pub const MAX_BYTES: u64 = 60 * 1024 * 1024;

const SOURCE: &str = "video";
const HEADERS_TIMEOUT: Duration = Duration::from_secs(15);
const CHUNK_TIMEOUT: Duration = Duration::from_secs(20);

enum Miss {
    Next(String),
    Stop(String),
}

pub async fn download(
    client: &Client,
    url: &str,
    target: &Path,
    report: &(dyn Fn(Progress) + Send + Sync),
) -> Result<(), String> {
    let part = target.with_extension("part");
    let mut errors = Vec::new();
    for (index, hop) in edge::plan(url).into_iter().enumerate() {
        match from_hop(client, &hop, Role::of_index(index), &part, report).await {
            Ok(()) => {
                fs::rename(&part, target).await.map_err(|e| e.to_string())?;
                return Ok(());
            }
            Err(Miss::Stop(err)) => {
                fs::remove_file(&part).await.ok();
                return Err(err);
            }
            Err(Miss::Next(err)) => {
                fs::remove_file(&part).await.ok();
                errors.push(format!("{}: {err}", hop.tier_label()));
            }
        }
    }
    if errors.is_empty() {
        Err("no video route".into())
    } else {
        Err(errors.join("; "))
    }
}

async fn from_hop(
    client: &Client,
    hop: &Hop,
    role: Role,
    part: &Path,
    report: &(dyn Fn(Progress) + Send + Sync),
) -> Result<(), Miss> {
    let response = send(client, hop, role).await?;
    if !edge::hop_ok(hop, &response) {
        return Err(Miss::Next(format!("HTTP {}", response.status())));
    }
    let status = response.status();
    hop.note(status.as_u16() < 500);
    if matches!(status.as_u16(), 404 | 410) {
        return Err(Miss::Stop(format!("HTTP {status}")));
    }
    if !status.is_success() {
        return Err(Miss::Next(format!("HTTP {status}")));
    }
    if response.content_length().is_some_and(|len| len > MAX_BYTES) {
        return Err(Miss::Stop("too big".into()));
    }
    let meter = Meter::new(report, response.content_length());
    let bytes = save(response, part, meter).await.inspect_err(|miss| {
        if matches!(miss, Miss::Next(_)) {
            hop.note(false);
        }
    })?;
    hop.note_delivered(bytes);
    Ok(())
}

async fn send(client: &Client, hop: &Hop, role: Role) -> Result<Response, Miss> {
    let (request, flight) = traced::begin(client, Method::GET, hop, role, SOURCE);
    match tokio::time::timeout(HEADERS_TIMEOUT, request.send()).await {
        Ok(Ok(response)) => {
            flight.answered(response.status().as_u16(), 0);
            Ok(response)
        }
        Ok(Err(err)) => {
            flight.broke(&err);
            hop.note(false);
            relay_speed::failed(hop);
            Err(Miss::Next(err.to_string()))
        }
        Err(_) => {
            let fail = Fail::timeout_after(HEADERS_TIMEOUT.as_millis() as u32);
            flight.failed(fail.kind, fail.to_string());
            hop.note(false);
            Err(Miss::Next(fail.to_string()))
        }
    }
}

async fn save(response: Response, part: &Path, mut meter: Meter<'_>) -> Result<u64, Miss> {
    let local = |err: std::io::Error| Miss::Stop(err.to_string());
    let mut file = File::create(part).await.map_err(local)?;
    let mut body = response.bytes_stream();
    let mut total = 0u64;
    loop {
        let chunk = match tokio::time::timeout(CHUNK_TIMEOUT, body.next()).await {
            Err(_) => return Err(Miss::Next("body stalled".into())),
            Ok(None) => break,
            Ok(Some(Err(err))) => return Err(Miss::Next(err.to_string())),
            Ok(Some(Ok(chunk))) => chunk,
        };
        total += chunk.len() as u64;
        if total > MAX_BYTES {
            return Err(Miss::Stop("too big".into()));
        }
        file.write_all(&chunk).await.map_err(local)?;
        meter.received(total, Instant::now());
    }
    file.flush().await.map_err(local)?;
    if total == 0 {
        return Err(Miss::Next("empty body".into()));
    }
    Ok(total)
}
