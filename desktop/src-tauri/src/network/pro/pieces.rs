use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use bytes::{Bytes, BytesMut};
use futures_util::stream::{self, BoxStream, StreamExt};
use http::Version;
use tokio::sync::mpsc;

const SPAN: u64 = 8 * 1024;
const PARALLEL: usize = 8;
const START_PIECE: usize = 8 * 1024;
const SMALLEST_PIECE: usize = 3 * 1024;
const ATTEMPTS: usize = 5;
const WAITING_TIMEOUT: Duration = Duration::from_secs(12);
const READY_TIMEOUT: Duration = Duration::from_secs(5);
const CLOSE_TIMEOUT: Duration = Duration::from_secs(5);
const QUIET_LIMIT: Duration = Duration::from_secs(60);
const END: &str = "x-pro-end";
const TOTAL: &str = "x-pro-total";

static PIECE: AtomicUsize = AtomicUsize::new(START_PIECE);

struct Piece {
    bytes: Bytes,
    end: bool,
    total: Option<u64>,
}

enum Failed {
    Link(String),
    Gone(String),
}

#[derive(Clone)]
struct Taker {
    client: &'static wreq::Client,
    answer: Arc<str>,
}

pub fn stream(
    client: &'static wreq::Client,
    answer: String,
    known_total: Option<u64>,
) -> BoxStream<'static, Result<Bytes, String>> {
    let (out, pieces) = mpsc::channel(PARALLEL);
    let taker = Taker {
        client,
        answer: answer.into(),
    };
    tokio::spawn(async move {
        if let Err(error) = taker.deliver(known_total, &out).await {
            out.send(Err(error)).await.ok();
        }
        taker.close().await;
    });
    stream::unfold(pieces, |mut pieces| async move {
        pieces.recv().await.map(|piece| (piece, pieces))
    })
    .boxed()
}

impl Taker {
    async fn deliver(
        &self,
        known_total: Option<u64>,
        out: &mpsc::Sender<Result<Bytes, String>>,
    ) -> Result<(), String> {
        let mut at = 0;
        let mut total = known_total;
        while total.is_none() {
            let piece = self.span(at, SPAN, WAITING_TIMEOUT).await?;
            at += piece.bytes.len() as u64;
            total = piece.total;
            if out.send(Ok(piece.bytes)).await.is_err() || piece.end {
                return Ok(());
            }
        }
        let total = total.unwrap_or(at);
        let spans = (at..total)
            .step_by(SPAN as usize)
            .map(|from| self.span(from, SPAN.min(total - from), READY_TIMEOUT));
        let mut ordered = stream::iter(spans).buffered(PARALLEL);
        while let Some(piece) = ordered.next().await {
            if out.send(Ok(piece?.bytes)).await.is_err() {
                return Ok(());
            }
        }
        Ok(())
    }

    async fn span(&self, from: u64, len: u64, timeout: Duration) -> Result<Piece, String> {
        let mut bytes = BytesMut::new();
        let mut quiet_since = Instant::now();
        loop {
            let left = len - bytes.len() as u64;
            let at = from + bytes.len() as u64;
            let piece = self.piece(at, left as usize, timeout).await?;
            if !piece.bytes.is_empty() {
                quiet_since = Instant::now();
            }
            bytes.extend_from_slice(&piece.bytes);
            if piece.end || bytes.len() as u64 == len {
                return Ok(Piece {
                    bytes: bytes.freeze(),
                    ..piece
                });
            }
            if quiet_since.elapsed() >= QUIET_LIMIT {
                return Err("pro: the origin went quiet".to_string());
            }
        }
    }

    async fn piece(&self, from: u64, most: usize, timeout: Duration) -> Result<Piece, String> {
        let mut last = String::new();
        for attempt in 0..ATTEMPTS {
            let size = most.min(PIECE.load(Ordering::Relaxed));
            match self.once(from, size, timeout).await {
                Ok(piece) => return Ok(piece),
                Err(Failed::Gone(why)) => return Err(why),
                Err(Failed::Link(why)) => {
                    if attempt > 0 {
                        shrink(size);
                    }
                    last = why;
                }
            }
        }
        Err(format!("pro: a piece did not come through: {last}"))
    }

    async fn once(&self, from: u64, max: usize, timeout: Duration) -> Result<Piece, Failed> {
        let link = |error: wreq::Error| Failed::Link(error.to_string());
        let response = self
            .client
            .get(format!("{}?from={from}&max={max}", self.answer))
            .version(Version::HTTP_11)
            .timeout(timeout)
            .send()
            .await
            .map_err(link)?;
        if !response.status().is_success() {
            return Err(Failed::Gone(format!(
                "pro: a piece answered {}",
                response.status()
            )));
        }
        let header = |name: &str| {
            response
                .headers()
                .get(name)
                .and_then(|value| value.to_str().ok())
                .map(str::to_string)
        };
        let end = header(END).as_deref() == Some("1");
        let total = header(TOTAL).and_then(|total| total.parse().ok());
        let bytes = response.bytes().await.map_err(link)?;
        Ok(Piece { bytes, end, total })
    }

    async fn close(&self) {
        self.client
            .delete(&*self.answer)
            .version(Version::HTTP_11)
            .timeout(CLOSE_TIMEOUT)
            .send()
            .await
            .ok();
    }
}

fn shrink(failed: usize) {
    let smaller = (failed / 2).max(SMALLEST_PIECE);
    PIECE.fetch_min(smaller, Ordering::Relaxed);
}

#[cfg(test)]
pub fn piece_size() -> usize {
    PIECE.load(Ordering::Relaxed)
}
