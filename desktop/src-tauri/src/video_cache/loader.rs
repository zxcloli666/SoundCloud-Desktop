use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use super::VideoCache;
use super::fetch::{self, Miss};
use super::reel::{Gap, Reel};
use crate::app::diagnostics;
use crate::network::edge;
use crate::network::netcheck::model::Role;

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
        let mut errors = Vec::new();
        for (index, hop) in edge::plan(&reel.url).into_iter().enumerate() {
            let role = Role::of_index(index);
            match fetch::pull(&self.client, &hop, role, reel, gap, at).await {
                Ok(()) => return Ok(()),
                Err(Miss::Stop(err)) => return Err(err),
                Err(Miss::Next(err)) => errors.push(format!("{}: {err}", hop.tier_label())),
            }
        }
        if errors.is_empty() {
            Err("no video route".into())
        } else {
            Err(errors.join("; "))
        }
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
