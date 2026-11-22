use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tokio::sync::Notify;

use super::Runtime;

const REFRESH: Duration = Duration::from_secs(30);
const RETRY: Duration = Duration::from_secs(5);

#[derive(Default)]
pub struct PublicWatch {
    wanted: AtomicBool,
    changed: Notify,
}

impl PublicWatch {
    pub fn set(&self, on: bool) {
        if self.wanted.swap(on, Ordering::SeqCst) != on {
            self.changed.notify_one();
        }
    }

    pub fn wanted(&self) -> bool {
        self.wanted.load(Ordering::SeqCst)
    }

    pub fn poke(&self) {
        self.changed.notify_one();
    }
}

pub fn watch(runtime: Arc<Runtime>, rt: &tokio::runtime::Handle) {
    rt.spawn(async move { runtime.run_public_watch().await });
}

impl Runtime {
    pub fn watch_public(&self, on: bool) {
        self.public.set(on);
    }

    async fn run_public_watch(&self) {
        let mut active = false;
        loop {
            let want = self.public.wanted() && self.signals.visible() && self.core().is_some();
            if !want && !active {
                self.public.changed.notified().await;
                continue;
            }
            let sent = if want {
                self.api.public_watch().await
            } else {
                self.api.public_unwatch().await
            };
            if sent.is_ok() {
                active = want;
            }
            let pause = if sent.is_ok() { REFRESH } else { RETRY };
            tokio::select! {
                _ = self.public.changed.notified() => {}
                _ = tokio::time::sleep(pause) => {}
            }
        }
    }
}
