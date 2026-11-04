use std::ops::Range;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use bytes::Bytes;
use futures_util::stream::{self, StreamExt};
use http::{StatusCode, Version};
use serde::{Deserialize, Serialize};

const START_PART: usize = 32 * 1024;
const SMALLEST_PART: usize = 4 * 1024;
const PARALLEL: usize = 4;
const ATTEMPTS: usize = 5;
const ROUNDS: usize = 16;
const ASK_TIMEOUT: Duration = Duration::from_secs(10);
const PART_TIMEOUT: Duration = Duration::from_secs(6);
const CLOSE_TIMEOUT: Duration = Duration::from_secs(5);
const PAUSE: Duration = Duration::from_millis(500);
const MOST_HOLES: usize = 257;
const LOST: [StatusCode; 2] = [StatusCode::NOT_FOUND, StatusCode::PAYLOAD_TOO_LARGE];
const UNSTAGED: [StatusCode; 2] = [StatusCode::NOT_FOUND, StatusCode::METHOD_NOT_ALLOWED];

static PART: AtomicUsize = AtomicUsize::new(START_PART);

#[derive(Serialize)]
struct Asked {
    size: u64,
}

#[derive(Deserialize)]
struct Staged {
    id: String,
    size: u64,
    missing: Vec<[u64; 2]>,
}

pub enum Failed {
    Link(String),
    Gone(String),
}

impl Failed {
    pub fn why(self) -> String {
        match self {
            Self::Link(why) | Self::Gone(why) => why,
        }
    }
}

pub struct Stage {
    client: &'static wreq::Client,
    url: String,
    pub id: String,
    size: u64,
}

pub async fn create(
    client: &'static wreq::Client,
    node: &str,
    size: u64,
) -> Result<Option<(Stage, Vec<Range<u64>>)>, String> {
    let mut last = String::new();
    for attempt in 0..ATTEMPTS {
        paused(attempt).await;
        let asked = client
            .post(format!("{node}/stage"))
            .version(Version::HTTP_11)
            .timeout(ASK_TIMEOUT)
            .json(&Asked { size })
            .send()
            .await;
        let response = match asked {
            Ok(response) => response,
            Err(error) => {
                last = error.to_string();
                continue;
            }
        };
        let status = response.status();
        if UNSTAGED.contains(&status) {
            return Ok(None);
        }
        if !status.is_success() {
            return Err(format!("pro: the stage answered {status}"));
        }
        match response.json::<Staged>().await {
            Ok(staged) => {
                let missing = holes(&staged.missing, staged.size, size)?;
                let stage = Stage {
                    client,
                    url: format!("{node}/stage/{}", staged.id),
                    id: staged.id,
                    size,
                };
                return Ok(Some((stage, missing)));
            }
            Err(error) => last = error.to_string(),
        }
    }
    Err(format!("pro: the stage did not open: {last}"))
}

pub async fn reopen(
    client: &'static wreq::Client,
    node: &str,
    id: &str,
    size: u64,
) -> Result<(Stage, Vec<Range<u64>>), Failed> {
    let stage = Stage {
        client,
        url: format!("{node}/stage/{id}"),
        id: id.to_string(),
        size,
    };
    let missing = stage.missing().await?;
    Ok((stage, missing))
}

impl Stage {
    pub async fn fill(&self, body: &[u8], mut missing: Vec<Range<u64>>) -> Result<(), String> {
        let mut stalls = 0;
        for _ in 0..ROUNDS {
            if missing.is_empty() {
                return Ok(());
            }
            let size = PART.load(Ordering::Relaxed);
            let left = bytes_in(&missing);
            let sent: Vec<Result<(), Failed>> = stream::iter(parts(&missing, size))
                .map(|part| self.put(body, part))
                .buffer_unordered(PARALLEL)
                .collect()
                .await;
            for result in &sent {
                if let Err(Failed::Gone(why)) = result {
                    return Err(why.clone());
                }
            }
            if sent.iter().all(Result::is_ok) {
                return Ok(());
            }
            shrink(size);
            missing = self.missing().await.map_err(Failed::why)?;
            stalls = if bytes_in(&missing) < left {
                0
            } else {
                stalls + 1
            };
            if stalls >= ATTEMPTS {
                return Err("pro: the stage stopped filling".to_string());
            }
        }
        Err("pro: the stage did not fill".to_string())
    }

    pub async fn missing(&self) -> Result<Vec<Range<u64>>, Failed> {
        let mut last = String::new();
        for attempt in 0..ATTEMPTS {
            paused(attempt).await;
            let asked = self
                .client
                .get(&self.url)
                .version(Version::HTTP_11)
                .timeout(ASK_TIMEOUT);
            match staged(asked).await {
                Ok(staged) => {
                    return holes(&staged.missing, staged.size, self.size).map_err(Failed::Gone);
                }
                Err(Failed::Gone(why)) => return Err(Failed::Gone(why)),
                Err(Failed::Link(why)) => last = why,
            }
        }
        Err(Failed::Link(format!(
            "pro: the stage did not answer: {last}"
        )))
    }

    pub fn close(self) {
        tokio::spawn(async move {
            self.client
                .delete(&self.url)
                .version(Version::HTTP_11)
                .timeout(CLOSE_TIMEOUT)
                .send()
                .await
                .ok();
        });
    }

    pub async fn put(&self, body: &[u8], part: Range<u64>) -> Result<(), Failed> {
        let bytes = Bytes::copy_from_slice(&body[part.start as usize..part.end as usize]);
        let response = self
            .client
            .put(format!("{}?at={}", self.url, part.start))
            .version(Version::HTTP_11)
            .timeout(PART_TIMEOUT)
            .body(bytes)
            .send()
            .await
            .map_err(|error| Failed::Link(error.to_string()))?;
        let status = response.status();
        if status.is_success() {
            return Ok(());
        }
        let why = format!("pro: a stage part answered {status}");
        Err(if LOST.contains(&status) {
            Failed::Gone(why)
        } else {
            Failed::Link(why)
        })
    }
}

async fn staged(asked: wreq::RequestBuilder) -> Result<Staged, Failed> {
    let link = |error: wreq::Error| Failed::Link(error.to_string());
    let response = asked.send().await.map_err(link)?;
    let status = response.status();
    if LOST.contains(&status) {
        return Err(Failed::Gone(format!("pro: the stage answered {status}")));
    }
    if !status.is_success() {
        return Err(Failed::Link(format!("pro: the stage answered {status}")));
    }
    response.json().await.map_err(link)
}

pub fn holes(missing: &[[u64; 2]], reported: u64, size: u64) -> Result<Vec<Range<u64>>, String> {
    let sane =
        missing.len() <= MOST_HOLES && missing.iter().all(|[from, to]| from < to && *to <= size);
    if reported != size || !sane {
        return Err("pro: the stage answer does not fit the body".to_string());
    }
    let mut sorted: Vec<Range<u64>> = missing.iter().map(|[from, to]| *from..*to).collect();
    sorted.sort_by_key(|hole| hole.start);
    let mut merged: Vec<Range<u64>> = Vec::with_capacity(sorted.len());
    for hole in sorted {
        match merged.last_mut() {
            Some(last) if hole.start <= last.end => last.end = last.end.max(hole.end),
            _ => merged.push(hole),
        }
    }
    Ok(merged)
}

pub fn parts(missing: &[Range<u64>], size: usize) -> Vec<Range<u64>> {
    missing
        .iter()
        .flat_map(|hole| {
            hole.clone()
                .step_by(size)
                .map(move |at| at..(at + size as u64).min(hole.end))
        })
        .collect()
}

async fn paused(attempt: usize) {
    if attempt > 0 {
        tokio::time::sleep(PAUSE * attempt as u32).await;
    }
}

pub fn bytes_in(missing: &[Range<u64>]) -> u64 {
    missing.iter().map(|hole| hole.end - hole.start).sum()
}

fn shrink(failed: usize) {
    PART.fetch_min((failed / 2).max(SMALLEST_PART), Ordering::Relaxed);
}

#[cfg(test)]
pub fn part_size() -> usize {
    PART.load(Ordering::Relaxed)
}
