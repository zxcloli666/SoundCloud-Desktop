use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sc_chat::{Clock, Millis, async_trait};

pub struct SystemClock;

#[async_trait]
impl Clock for SystemClock {
    fn now_ms(&self) -> Millis {
        wall_ms()
    }

    async fn sleep(&self, ms: u64) {
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }
}

pub fn wall_ms() -> Millis {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

pub fn jitter(max_ms: u64) -> u64 {
    if max_ms == 0 {
        return 0;
    }
    let roll = sc_chat::sc_chat_wire::random_bytes::<8>()
        .map(u64::from_le_bytes)
        .unwrap_or(0);
    roll % (max_ms + 1)
}

pub fn spread(pause_ms: u64, roll_ms: u64) -> u64 {
    pause_ms - pause_ms / 5 + roll_ms.min(pause_ms * 2 / 5)
}
