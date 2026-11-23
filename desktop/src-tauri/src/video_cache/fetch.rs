use std::io::SeekFrom;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use futures_util::StreamExt;
use futures_util::stream::FuturesUnordered;
use tokio::fs::OpenOptions;
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use wreq::header::{CONTENT_RANGE, RANGE};
use wreq::{Client, Method, Response, StatusCode};

use super::reel::{Gap, Reel};
use crate::network::edge::{self, Hop};
use crate::network::fail::Fail;
use crate::network::netcheck::model::Role;
use crate::network::relay_speed;
use crate::network::traced;

const MAX_BYTES: u64 = 60 * 1024 * 1024;

const SOURCE: &str = "video";
const HEADERS_TIMEOUT: Duration = Duration::from_secs(15);
const HEDGE_AFTER: Duration = Duration::from_secs(2);
const CHUNK_TIMEOUT: Duration = Duration::from_secs(10);

pub enum Miss {
    Next(String),
    Stop(String),
}

pub struct Answer {
    hop: Hop,
    response: Response,
    start: u64,
    total: u64,
}

pub async fn ask(client: &Client, reel: &Reel, gap: &Gap) -> Result<Answer, String> {
    let mut hops = edge::plan(&reel.url).into_iter().enumerate();
    let mut asks = FuturesUnordered::new();
    let mut errors = Vec::new();
    loop {
        if asks.is_empty() {
            let Some((index, hop)) = hops.next() else {
                return Err(told(&errors));
            };
            asks.push(answer(client, hop, Role::of_index(index), gap));
        }
        tokio::select! {
            Some(came) = asks.next() => match came {
                Ok(answer) => return Ok(answer),
                Err(Miss::Stop(err)) => return Err(err),
                Err(Miss::Next(err)) => errors.push(err),
            },
            () = tokio::time::sleep(HEDGE_AFTER), if hops.len() > 0 => {
                if let Some((_, hop)) = hops.next() {
                    asks.push(answer(client, hop, Role::Hedge, gap));
                }
            }
        }
    }
}

pub async fn pull(answer: Answer, reel: &Reel, at: &AtomicU64) -> Result<(), Miss> {
    let Answer {
        hop,
        response,
        start,
        total,
    } = answer;
    if total == 0 || total > MAX_BYTES {
        return Err(Miss::Stop(format!("{total} bytes")));
    }
    reel.learn(total).map_err(Miss::Stop)?;
    at.store(start, Ordering::Relaxed);
    let saved = save(response, reel, at).await;
    let bytes = at.load(Ordering::Relaxed) - start;
    if matches!(saved, Err(Miss::Next(_))) {
        hop.note(false);
    } else {
        hop.note_delivered(bytes);
    }
    if bytes > 0 {
        return Ok(());
    }
    saved.and(Err(Miss::Next("empty body".into())))
}

async fn answer(client: &Client, hop: Hop, role: Role, gap: &Gap) -> Result<Answer, Miss> {
    let next = |err: String| Miss::Next(format!("{}: {err}", hop.tier_label()));
    let response = send(client, &hop, role, gap).await.map_err(next)?;
    let status = response.status();
    if !edge::hop_ok(&hop, &response) {
        return Err(next(format!("HTTP {status}")));
    }
    hop.note(status.as_u16() < 500);
    if matches!(status.as_u16(), 404 | 410) {
        return Err(Miss::Stop(format!("HTTP {status}")));
    }
    if !status.is_success() {
        return Err(next(format!("HTTP {status}")));
    }
    let Some((start, total)) = placed(&response, gap) else {
        return Err(next("no size".into()));
    };
    Ok(Answer {
        hop,
        response,
        start,
        total,
    })
}

async fn send(client: &Client, hop: &Hop, role: Role, gap: &Gap) -> Result<Response, String> {
    let (request, flight) = traced::begin(client, Method::GET, hop, role, SOURCE);
    let request = request.header(RANGE, range_of(gap));
    match tokio::time::timeout(HEADERS_TIMEOUT, request.send()).await {
        Ok(Ok(response)) => {
            flight.answered(response.status().as_u16(), 0);
            Ok(response)
        }
        Ok(Err(err)) => {
            flight.broke(&err);
            hop.note(false);
            relay_speed::failed(hop);
            Err(err.to_string())
        }
        Err(_) => {
            let fail = Fail::timeout_after(HEADERS_TIMEOUT.as_millis() as u32);
            flight.failed(fail.kind, fail.to_string());
            hop.note(false);
            Err(fail.to_string())
        }
    }
}

async fn save(response: Response, reel: &Reel, at: &AtomicU64) -> Result<(), Miss> {
    let local = |err: std::io::Error| Miss::Stop(err.to_string());
    let mut file = OpenOptions::new()
        .write(true)
        .open(reel.part())
        .await
        .map_err(local)?;
    let mut place = at.load(Ordering::Relaxed);
    file.seek(SeekFrom::Start(place)).await.map_err(local)?;
    let mut body = response.bytes_stream();
    loop {
        let chunk = match tokio::time::timeout(CHUNK_TIMEOUT, body.next()).await {
            Err(_) => return Err(Miss::Next("body stalled".into())),
            Ok(None) => return Ok(()),
            Ok(Some(Err(err))) => return Err(Miss::Next(err.to_string())),
            Ok(Some(Ok(chunk))) => chunk,
        };
        file.write_all(&chunk).await.map_err(local)?;
        file.flush().await.map_err(local)?;
        let end = place + chunk.len() as u64;
        reel.landed(place..end);
        place = end;
        at.store(place, Ordering::Relaxed);
    }
}

fn told(errors: &[String]) -> String {
    if errors.is_empty() {
        "no video route".into()
    } else {
        errors.join("; ")
    }
}

fn placed(response: &Response, gap: &Gap) -> Option<(u64, u64)> {
    if response.status() != StatusCode::PARTIAL_CONTENT {
        return response.content_length().map(|total| (0, total));
    }
    let value = response.headers().get(CONTENT_RANGE)?.to_str().ok()?;
    content_range(value).filter(|(start, _)| *start == gap.start)
}

fn range_of(gap: &Gap) -> String {
    match gap.end {
        Some(end) => format!("bytes={}-{}", gap.start, end - 1),
        None => format!("bytes={}-", gap.start),
    }
}

fn content_range(value: &str) -> Option<(u64, u64)> {
    let (span, total) = value.trim().strip_prefix("bytes ")?.split_once('/')?;
    let (start, _) = span.split_once('-')?;
    Some((start.parse().ok()?, total.parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::{Gap, content_range, range_of};

    #[test]
    fn a_gap_becomes_a_closed_range_and_the_first_ask_is_open() {
        let closed = Gap {
            start: 10,
            end: Some(20),
            reader: 0,
        };
        let open = Gap {
            start: 0,
            end: None,
            reader: 0,
        };
        assert_eq!(range_of(&closed), "bytes=10-19");
        assert_eq!(range_of(&open), "bytes=0-");
    }

    #[test]
    fn the_answer_says_where_it_starts_and_how_big_the_video_is() {
        assert_eq!(content_range("bytes 10-19/100"), Some((10, 100)));
        assert_eq!(content_range("bytes */100"), None);
        assert_eq!(content_range("bytes 0-9/*"), None);
    }
}
