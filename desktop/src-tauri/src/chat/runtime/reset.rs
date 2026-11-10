use std::sync::{Arc, Weak};
use std::time::Duration;

use sc_chat::store::Store;
use sc_chat::{ChatError, ChatResult, KeyStorage, KeyStore, MediaUploadsEvent};

use super::Runtime;
use super::lifecycle::{Keys, uploads_gone};
use super::local::Core;
use crate::app::diagnostics;
use crate::chat::keychain::ResetPlan;
use crate::chat::login;
use crate::chat::media_cache::MediaCache;

const CLOSE_POLL: Duration = Duration::from_millis(50);
const CLOSE_POLLS: u32 = 100;

impl Runtime {
    pub fn reset_plan(&self) -> ResetPlan {
        choose_plan(
            self.core().is_some(),
            cfg!(windows),
            self.keychain.storage(),
            self.keychain.reset_lately(),
        )
    }

    pub async fn reset_keys(&self) -> ChatResult<()> {
        let _lifecycle = self.lifecycle.lock().await;
        let plan = self.reset_plan();
        let identity = self.api.identity();
        let was_out = self.session.logged_out();
        self.session.log_out();
        login::forget_held();
        let reset = self.wipe_held(Keys::Reset(plan)).await;
        match (&reset, identity) {
            (Ok(()), Some(identity)) => self.remove_on_server(identity),
            (Err(_), _) if !was_out => self.session.log_in(),
            _ => {}
        }
        self.status
            .update(|status| status.key_storage = self.keychain.storage());
        self.restart();
        reset
    }

    pub(super) async fn reset_local(
        &self,
        core: Option<Arc<Core>>,
        local_media: Option<Arc<MediaCache>>,
        plan: ResetPlan,
    ) -> (ChatResult<()>, Option<MediaUploadsEvent>) {
        let gone = match core {
            Some(core) => self.close(core).await,
            None => None,
        };
        let keychain = self.keychain.clone();
        let reset = self
            .rt
            .spawn_blocking(move || {
                if let Some(cache) = local_media {
                    let _ = cache.clear();
                }
                keychain.reset(plan)
            })
            .await
            .unwrap_or(Err(ChatError::Internal));
        (reset, gone)
    }

    async fn close(&self, core: Arc<Core>) -> Option<MediaUploadsEvent> {
        let store = core.store.clone();
        drop(core);
        let closing = Arc::downgrade(&store);
        let gone = self
            .rt
            .spawn_blocking(move || uploads_gone(&store))
            .await
            .ok()
            .flatten();
        released(&closing).await;
        gone
    }
}

async fn released(store: &Weak<Store>) {
    for _ in 0..CLOSE_POLLS {
        if store.strong_count() == 0 {
            return;
        }
        tokio::time::sleep(CLOSE_POLL).await;
    }
    diagnostics::warn("[chat] the chat store is still open, the reset goes on");
}

pub fn choose_plan(
    chats_open: bool,
    windows: bool,
    storage: KeyStorage,
    reset_lately: bool,
) -> ResetPlan {
    if storage == KeyStorage::File || reset_lately {
        ResetPlan::File
    } else if chats_open {
        ResetPlan::InPlace
    } else if windows {
        ResetPlan::Probe
    } else {
        ResetPlan::File
    }
}
