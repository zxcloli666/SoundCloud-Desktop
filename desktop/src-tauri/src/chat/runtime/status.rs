use std::sync::{Arc, Mutex};

use sc_chat::{ChatStatus, CoreEvent, Events};

pub struct StatusCell {
    status: Mutex<ChatStatus>,
    events: Arc<dyn Events>,
}

impl StatusCell {
    pub fn new(events: Arc<dyn Events>) -> Self {
        Self {
            status: Mutex::new(ChatStatus::off()),
            events,
        }
    }

    pub fn get(&self) -> ChatStatus {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_else(|_| ChatStatus::off())
    }

    pub fn update(&self, change: impl FnOnce(&mut ChatStatus)) {
        let changed = {
            let Ok(mut status) = self.status.lock() else {
                return;
            };
            let before = status.clone();
            change(&mut status);
            (*status != before).then(|| status.clone())
        };
        if let Some(status) = changed {
            self.events.emit(CoreEvent::Status(status));
        }
    }

    pub fn absorb(&self, engine: &ChatStatus) {
        self.update(|status| take_engine_part(status, engine));
    }
}

pub fn take_engine_part(status: &mut ChatStatus, engine: &ChatStatus) {
    status.online = engine.online;
    status.tier = engine.tier;
    status.visible = engine.visible;
    status.history = engine.history.clone();
    status.unread = engine.unread;
    status.mentions = engine.mentions;
    status.requests = engine.requests;
}
