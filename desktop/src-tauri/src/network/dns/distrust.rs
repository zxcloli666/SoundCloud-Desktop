use std::time::Duration;

use futures_util::stream::{self, StreamExt};
use tokio::time::Instant;

use super::fallback::Fallback;
use super::spawn;

const WARM_EVERY: Duration = Duration::from_secs(600);
const WARM_PARALLEL: usize = 3;

impl Fallback {
    pub(super) fn distrusted(&self, now: Instant) -> bool {
        self.memory()
            .distrusted_until
            .is_some_and(|until| now < until)
    }

    pub(super) fn distrust(&self, span: Duration) -> bool {
        let now = Instant::now();
        let until = now + span;
        let mut memory = self.memory();
        let started = memory.distrusted_until.is_none_or(|at| at <= now);
        memory.distrusted_until = Some(memory.distrusted_until.map_or(until, |at| at.max(until)));
        started
    }

    pub(super) fn warm(&self) {
        let now = Instant::now();
        {
            let mut memory = self.memory();
            if memory
                .warmed_at
                .is_some_and(|at| now.duration_since(at) < WARM_EVERY)
            {
                return;
            }
            memory.warmed_at = Some(now);
        }
        let this = self.clone();
        spawn(async move {
            let hosts = (this.0.config.zone)();
            stream::iter(hosts)
                .for_each_concurrent(WARM_PARALLEL, |host| {
                    let this = this.clone();
                    async move {
                        if this.memory().cache.fresh(&host, Instant::now()).is_none() {
                            let _ = this.ask_doh(&host).await;
                        }
                    }
                })
                .await;
        });
    }
}
