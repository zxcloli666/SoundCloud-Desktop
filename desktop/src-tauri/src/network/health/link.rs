use std::time::{Duration, Instant};

use futures_util::StreamExt;
use wreq::Client;
use sha2::{Digest, Sha256};

use super::model::Link;

/// Счётчик DPI срабатывает на 9-16 КБ тела, поэтому проба каждого круга взята с
/// пятикратным запасом: порог обязан оказаться внутри неё.
pub const PROBE_BYTES: u64 = 64 * 1024;
/// Редкая глубокая проба: столько нужно, чтобы устойчивая скорость измерялась по
/// нескольким round-trip'ам, а не по одному всплеску.
pub const DEEP_BYTES: u64 = 512 * 1024;
/// Заведомо ДО срабатывания счётчика.
pub const SMALL_BYTES: u64 = 8 * 1024;
/// Байты до этой отметки в расчёт скорости не идут: там разгон TCP и зона
/// срабатывания счётчика.
const WARMUP_BYTES: u64 = 16 * 1024;
/// Рез по объёму наблюдался и на 9, и на 13 КБ. Ниже этого обрыв на рез не
/// похож: столько отдаёт даже соединение, которое просто не встало.
pub const CUT_FLOOR: u64 = 5 * 1024;
const DEADLINE: Duration = Duration::from_secs(25);
const DEADLINE_SLACK: Duration = Duration::from_secs(5);
const STALL: Duration = Duration::from_secs(6);
const FLOOR_BPS: u64 = 384_000;
const ATTRIBUTION_RATIO: u32 = 4;
const DIGEST_HEADER: &str = "x-probe-sha256";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shape {
    Clear,
    Slow,
    Throttled,
    Cut,
    Blackhole,
    Reset,
    Tamper,
    Dead,
}

impl Shape {
    pub fn usable(self) -> bool {
        matches!(self, Shape::Clear | Shape::Slow)
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Shape::Clear => "clear",
            Shape::Slow => "slow",
            Shape::Throttled => "throttled",
            Shape::Cut => "cut",
            Shape::Blackhole => "blackhole",
            Shape::Reset => "reset",
            Shape::Tamper => "tamper",
            Shape::Dead => "dead",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Measured {
    pub shape: Shape,
    pub link: Link,
    pub ms: i32,
    pub transfer: Duration,
    pub warmup_at: Duration,
    pub connected: bool,
}

impl Measured {
    /// Скорость на участке ПОСЛЕ разгона. Средняя по всему телу занижена ровно
    /// там, где путь далёкий.
    pub fn sustained_bps(&self) -> u64 {
        rate(
            (self.link.bytes as u64).saturating_sub(WARMUP_BYTES),
            self.transfer.saturating_sub(self.warmup_at),
        )
    }
}

pub async fn probe(client: &Client, url: &str, size: u64) -> Measured {
    let started = Instant::now();
    let response = match client
        .get(probe_url(url, size))
        .timeout(DEADLINE + DEADLINE_SLACK)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        Ok(_) => return failed(Shape::Dead, 0, started),
        Err(error) => {
            let shape = if error.is_timeout() {
                Shape::Blackhole
            } else {
                Shape::Reset
            };
            return Measured {
                connected: !error.is_connect(),
                ..failed(shape, 0, started)
            };
        }
    };

    let expected = response
        .headers()
        .get(DIGEST_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_ascii_lowercase);

    let opened = Instant::now();
    let mut body = response.bytes_stream();
    let mut digest = Sha256::new();
    let mut bytes = 0u64;
    let mut warmup_at = Duration::ZERO;
    let mut ran_out = false;
    let mut torn = false;

    loop {
        let next = match tokio::time::timeout(STALL, body.next()).await {
            Ok(next) => next,
            Err(_) => return failed(Shape::Blackhole, bytes, started),
        };
        let Some(chunk) = next else { break };
        let Ok(chunk) = chunk else {
            torn = true;
            break;
        };
        digest.update(&chunk);
        bytes += chunk.len() as u64;
        if warmup_at.is_zero() && bytes >= WARMUP_BYTES {
            warmup_at = opened.elapsed();
        }
        if bytes >= size {
            break;
        }
        if started.elapsed() >= DEADLINE {
            ran_out = true;
            break;
        }
    }

    let transfer = opened.elapsed();
    let done = |shape: Shape| Measured {
        shape,
        link: Link {
            shape: shape.as_str(),
            kbps: (rate(bytes, transfer) / 1000).min(i32::MAX as u64) as i32,
            bytes: bytes.min(i64::MAX as u64) as i64,
        },
        ms: started.elapsed().as_millis().min(i32::MAX as u128) as i32,
        transfer,
        warmup_at,
        connected: true,
    };

    if torn || (bytes < size && !ran_out) {
        return done(cut_or_reset(bytes));
    }
    if ran_out {
        return done(Shape::Slow);
    }
    if let Some(expected) = expected
        && hex(digest.finalize().as_slice()) != expected
    {
        return done(Shape::Tamper);
    }
    if bytes > WARMUP_BYTES * 2
        && rate(
            bytes.saturating_sub(WARMUP_BYTES),
            transfer.saturating_sub(warmup_at),
        ) < FLOOR_BPS
    {
        return done(Shape::Slow);
    }
    done(Shape::Clear)
}

/// Узкий канал или предел по объёму. Маленькая проба целиком укладывается до
/// срабатывания счётчика, поэтому на задушенном пути она летит, а на честно
/// узком ползёт пропорционально своему размеру.
pub fn attribute(deep: &Measured, small: &Measured) -> Shape {
    if deep.shape != Shape::Slow {
        return deep.shape;
    }
    let sustained = deep.sustained_bps();
    if sustained == 0 || small.shape != Shape::Clear {
        return Shape::Slow;
    }
    let expected = Duration::from_secs_f64(small.link.bytes as f64 * 8.0 / sustained as f64);
    if small.transfer * ATTRIBUTION_RATIO < expected {
        Shape::Throttled
    } else {
        Shape::Slow
    }
}

fn probe_url(url: &str, size: u64) -> String {
    let separator = if url.contains('?') { '&' } else { '?' };
    format!("{url}{separator}bytes={size}")
}

fn failed(shape: Shape, bytes: u64, started: Instant) -> Measured {
    Measured {
        shape,
        link: Link {
            shape: shape.as_str(),
            kbps: 0,
            bytes: bytes.min(i64::MAX as u64) as i64,
        },
        ms: started.elapsed().as_millis().min(i32::MAX as u128) as i32,
        transfer: Duration::ZERO,
        warmup_at: Duration::ZERO,
        connected: true,
    }
}

fn cut_or_reset(bytes: u64) -> Shape {
    if bytes >= CUT_FLOOR {
        Shape::Cut
    } else {
        Shape::Reset
    }
}

fn rate(bytes: u64, elapsed: Duration) -> u64 {
    let secs = elapsed.as_secs_f64();
    if secs <= 0.0 || bytes == 0 {
        return 0;
    }
    (bytes as f64 * 8.0 / secs) as u64
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secs(value: f64) -> Duration {
        Duration::from_secs_f64(value)
    }

    fn measured(shape: Shape, bytes: u64, transfer: f64, warmup_at: f64) -> Measured {
        Measured {
            shape,
            link: Link {
                shape: shape.as_str(),
                kbps: 0,
                bytes: bytes as i64,
            },
            ms: 0,
            transfer: secs(transfer),
            warmup_at: secs(warmup_at),
            connected: true,
        }
    }

    #[test]
    fn a_far_node_is_judged_by_the_stretch_after_the_ramp_not_by_the_average() {
        let far = measured(Shape::Clear, PROBE_BYTES, 0.6, 0.25);
        assert!(far.sustained_bps() > FLOOR_BPS, "{}", far.sustained_bps());
        assert!(rate(PROBE_BYTES, secs(0.6)) < far.sustained_bps());
    }

    #[test]
    fn a_throttled_path_is_told_apart_from_a_narrow_one_by_the_small_probe() {
        let deep = measured(Shape::Slow, DEEP_BYTES, 20.0, 0.05);
        let quick = measured(Shape::Clear, SMALL_BYTES, 0.006, 0.0);
        let crawling = measured(Shape::Clear, SMALL_BYTES, 0.33, 0.0);
        assert_eq!(attribute(&deep, &quick), Shape::Throttled);
        assert_eq!(attribute(&deep, &crawling), Shape::Slow);
    }

    #[test]
    fn attribution_never_upgrades_a_verdict_it_was_not_asked_about() {
        let cut = measured(Shape::Cut, 13 * 1024, 0.4, 0.1);
        let quick = measured(Shape::Clear, SMALL_BYTES, 0.006, 0.0);
        assert_eq!(attribute(&cut, &quick), Shape::Cut);
    }

    #[test]
    fn the_size_is_asked_for_on_the_wire() {
        assert_eq!(probe_url("https://n/probe", 8192), "https://n/probe?bytes=8192");
        assert_eq!(probe_url("https://n/probe?x=1", 64), "https://n/probe?x=1&bytes=64");
    }

    #[test]
    fn a_cut_below_the_head_window_is_still_a_cut() {
        for bytes in [9 * 1024, 13 * 1024, 16 * 1024] {
            assert_eq!(cut_or_reset(bytes), Shape::Cut, "оборвано на {bytes} байт");
        }
        assert_eq!(cut_or_reset(CUT_FLOOR), Shape::Cut);
        assert_eq!(cut_or_reset(CUT_FLOOR - 1), Shape::Reset);
    }

    #[test]
    fn throughput_is_measured_over_the_body_not_over_the_whole_request() {
        assert!(rate(PROBE_BYTES, secs(0.74)) > FLOOR_BPS);
        assert!(rate(PROBE_BYTES, secs(1.82)) < FLOOR_BPS);
    }

    #[test]
    fn a_narrow_channel_is_not_interference() {
        assert!(Shape::Slow.usable());
        assert!(Shape::Clear.usable());
        assert!(!Shape::Throttled.usable());
        assert!(!Shape::Cut.usable());
        assert!(!Shape::Blackhole.usable());
        assert!(!Shape::Tamper.usable());
    }

    #[test]
    fn the_digest_format_matches_what_the_nodes_publish() {
        assert_eq!(
            hex(Sha256::digest(b"").as_slice()),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn a_dead_transfer_still_reports_how_long_it_waited() {
        let measured = failed(Shape::Blackhole, 13 * 1024, Instant::now());
        assert_eq!(measured.shape, Shape::Blackhole);
        assert_eq!(measured.link.kbps, 0);
    }
}
