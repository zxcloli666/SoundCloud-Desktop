use std::sync::{Arc, Weak};
use std::time::Duration;

use sc_chat::Events;
use sc_chat::store::ExpiryTimer;
use sc_chat::store::expiry::NAP_MAX_MS;

use super::Runtime;
use super::local::Core;

const SOONEST_MS: u64 = 1_000;

impl Runtime {
    pub(super) fn watch_expiry(self: &Arc<Self>, core: &Arc<Core>) {
        let runtime = self.clone();
        let events: Arc<dyn Events> = self.events.clone();
        let timer = Arc::new(ExpiryTimer::new(
            core.store.clone(),
            self.clock.clone(),
            events,
        ));
        let core = Arc::downgrade(core);
        self.rt.spawn(async move {
            while runtime.still_open(&core) {
                let sweeper = timer.clone();
                let swept = runtime.rt.spawn_blocking(move || sweeper.sweep()).await;
                let nap = swept.ok().and_then(Result::ok).unwrap_or(NAP_MAX_MS);
                tokio::time::sleep(nap_of(nap)).await;
            }
        });
    }

    fn still_open(&self, core: &Weak<Core>) -> bool {
        let Some(core) = core.upgrade() else {
            return false;
        };
        self.core().is_some_and(|open| Arc::ptr_eq(&open, &core))
    }
}

pub fn nap_of(nap_ms: u64) -> Duration {
    Duration::from_millis(nap_ms.clamp(SOONEST_MS, NAP_MAX_MS))
}
