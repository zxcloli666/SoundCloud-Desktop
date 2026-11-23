use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use super::VideoCache;
use super::fetch::{self, Miss};
use super::reel::{Gap, Reel};
use crate::app::diagnostics;

const TRIES: usize = 3;

impl VideoCache {
    pub fn start(self: &Arc<Self>) {
        let cache = self.clone();
        tauri::async_runtime::spawn(async move { cache.work().await });
    }

    async fn work(&self) {
        let mut poked = self.poke.subscribe();
        loop {
            let current = self.desk().current();
            match current {
                Some(reel) => self.fill(&reel).await,
                None => {
                    poked.changed().await.ok();
                }
            }
        }
    }

    async fn fill(&self, reel: &Arc<Reel>) {
        let Some(gap) = reel.gap() else {
            return reel.finish();
        };
        let at = AtomicU64::new(gap.start);
        tokio::select! {
            end = self.through_hops(reel, &gap, &at) => {
                if let Err(err) = end {
                    diagnostics::warn(format!("[Video] {}: {err}", reel.name));
                    reel.fail(err);
                }
            }
            () = self.called_away(reel, &at) => {}
        }
    }

    async fn through_hops(&self, reel: &Reel, gap: &Gap, at: &AtomicU64) -> Result<(), String> {
        let mut last = String::new();
        for _ in 0..TRIES {
            let answer = fetch::ask(&self.client, reel, gap).await?;
            match fetch::pull(answer, reel, at).await {
                Ok(()) => return Ok(()),
                Err(Miss::Stop(err)) => return Err(err),
                Err(Miss::Next(err)) => last = err,
            }
        }
        Err(last)
    }

    async fn called_away(&self, reel: &Arc<Reel>, at: &AtomicU64) {
        let mut poked = self.poke.subscribe();
        loop {
            let current = self.desk().current();
            let mine = current.is_some_and(|current| Arc::ptr_eq(&current, reel));
            if !mine || reel.asks_elsewhere(at.load(Ordering::Relaxed)) {
                return;
            }
            poked.changed().await.ok();
        }
    }
}
