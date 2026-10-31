use std::future::Future;
use std::time::Duration;

use tokio::time::Instant;

use crate::network::edge::Hop;

const WARMUP_BYTES: u64 = 64 * 1024;
const SAMPLE_BYTES: u64 = 512 * 1024;
const SAMPLE_SPAN: Duration = Duration::from_secs(2);
const STALL: Duration = Duration::from_secs(4);

#[derive(Default)]
pub struct Meter {
    node: Option<String>,
    bytes: u64,
    mark: Option<(Instant, u64)>,
    stalled: bool,
}

impl Meter {
    pub fn of(hop: &Hop) -> Self {
        Self {
            node: super::node_of(hop),
            ..Self::default()
        }
    }

    pub async fn watch<F: Future + Unpin>(&mut self, mut next: F) -> F::Output {
        if self.node.is_none() {
            return next.await;
        }
        match tokio::time::timeout(STALL, &mut next).await {
            Ok(output) => output,
            Err(_) => {
                self.stall();
                next.await
            }
        }
    }

    pub fn got(&mut self, len: usize) {
        self.bytes += len as u64;
        if self.mark.is_none() && self.bytes >= WARMUP_BYTES {
            self.mark = Some((Instant::now(), self.bytes));
        }
    }

    pub fn broke(&self) {
        if let Some(node) = &self.node {
            super::slow(node);
        }
    }

    pub fn done(&self) {
        if self.stalled {
            return;
        }
        if let (Some(node), Some(speed)) = (&self.node, self.sample()) {
            super::sampled(node, speed);
        }
    }

    pub(super) fn speed(&self) -> u64 {
        let Some((at, from)) = self.mark else {
            return 0;
        };
        let secs = at.elapsed().as_secs_f64();
        if secs <= 0.0 {
            return 0;
        }
        ((self.bytes - from) as f64 / secs) as u64
    }

    fn sample(&self) -> Option<u64> {
        let (at, _) = self.mark?;
        let lasted = at.elapsed() >= SAMPLE_SPAN;
        (self.bytes >= SAMPLE_BYTES && lasted).then(|| self.speed())
    }

    fn stall(&mut self) {
        if let Some(node) = &self.node
            && !self.stalled
        {
            self.stalled = true;
            super::slow(node);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::{Meter, SAMPLE_BYTES, STALL, WARMUP_BYTES};
    use crate::network::edge::{Hop, Tier};

    const KB: u64 = 1024;

    fn relay(node: &str) -> Meter {
        Meter::of(&Hop {
            url: format!("https://storage.{node}.relay.scnative.dev/v1/tracks/1"),
            tier: Tier::Relay,
            origin: "storage".to_string(),
        })
    }

    async fn body(meter: &mut Meter, bytes: u64, lasting: Duration) {
        let chunks = 32;
        let tail = bytes - WARMUP_BYTES;
        meter.got(WARMUP_BYTES as usize);
        for _ in 0..chunks {
            tokio::time::advance(lasting / chunks).await;
            meter.got((tail / u64::from(chunks)) as usize);
        }
    }

    #[tokio::test(start_paused = true)]
    async fn a_sample_is_the_speed_after_the_first_64_kb() {
        let mut meter = relay("r1");
        body(&mut meter, 576 * KB, Duration::from_secs(8)).await;
        assert_eq!(meter.sample(), Some(64 * KB));
    }

    #[tokio::test(start_paused = true)]
    async fn a_body_under_512_kb_is_no_sample() {
        let mut meter = relay("r1");
        body(&mut meter, SAMPLE_BYTES - 64 * KB, Duration::from_secs(8)).await;
        assert_eq!(meter.sample(), None);
    }

    #[tokio::test(start_paused = true)]
    async fn a_body_shorter_than_2_s_is_no_sample() {
        let mut meter = relay("r1");
        body(&mut meter, 2048 * KB, Duration::from_millis(1900)).await;
        assert_eq!(meter.sample(), None);
    }

    #[tokio::test(start_paused = true)]
    async fn four_silent_seconds_in_the_body_count_as_a_stall() {
        let mut meter = relay("r1");
        let next = std::pin::pin!(tokio::time::sleep(STALL - Duration::from_millis(100)));
        meter.watch(next).await;
        assert!(!meter.stalled);
        let next = std::pin::pin!(tokio::time::sleep(STALL + Duration::from_secs(1)));
        meter.watch(next).await;
        assert!(meter.stalled);
    }

    #[tokio::test(start_paused = true)]
    async fn the_waited_chunk_still_arrives_after_a_stall() {
        let mut meter = relay("r1");
        let started = tokio::time::Instant::now();
        let next = std::pin::pin!(async {
            tokio::time::sleep(Duration::from_secs(9)).await;
            "chunk"
        });
        assert_eq!(meter.watch(next).await, "chunk");
        assert_eq!(started.elapsed(), Duration::from_secs(9));
    }

    #[test]
    fn only_relay_hops_are_measured() {
        let pro = Meter::of(&Hop {
            url: "http://127.0.0.1:4321/pro/p1.pro.scnative.dev/aHR0cHM".to_string(),
            tier: Tier::Pro,
            origin: "storage".to_string(),
        });
        let direct = Meter::of(&Hop {
            url: "https://images.scnative.dev/a.jpg".to_string(),
            tier: Tier::Direct,
            origin: "images".to_string(),
        });
        assert_eq!(relay("r7").node.as_deref(), Some("r7"));
        assert_eq!(pro.node, None);
        assert_eq!(direct.node, None);
    }
}
