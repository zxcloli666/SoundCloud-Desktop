use std::sync::Arc;
use std::time::Duration;

use sc_chat::Millis;
use tokio::time::MissedTickBehavior;

use super::Runtime;
use super::clock::wall_ms;

const TICK: Duration = Duration::from_secs(5);
const SLACK_MS: Millis = 20_000;

pub struct WakeWatch {
    last_ms: Millis,
}

impl WakeWatch {
    pub fn new(now_ms: Millis) -> Self {
        Self { last_ms: now_ms }
    }

    pub fn woke(&mut self, now_ms: Millis) -> bool {
        let gap = now_ms - self.last_ms;
        self.last_ms = now_ms;
        let tick = Millis::try_from(TICK.as_millis()).unwrap_or(Millis::MAX);
        gap > tick + SLACK_MS || gap < -SLACK_MS
    }
}

pub fn watch(runtime: Arc<Runtime>, rt: &tokio::runtime::Handle) {
    rt.spawn(async move {
        let mut watch = WakeWatch::new(wall_ms());
        let mut tick = tokio::time::interval(TICK);
        tick.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            tick.tick().await;
            if watch.woke(wall_ms()) {
                runtime.woke_up();
            }
        }
    });
}
