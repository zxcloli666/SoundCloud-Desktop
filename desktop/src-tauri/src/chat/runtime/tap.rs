use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use sc_chat::{ConvId, CoreEvent, Events, UserId};

use super::status::StatusCell;

const TYPING_FOR: Duration = Duration::from_secs(6);

pub struct Tap {
    inner: Arc<dyn Events>,
    status: Arc<StatusCell>,
    typing: Mutex<HashMap<ConvId, (Vec<UserId>, Instant)>>,
}

impl Tap {
    pub fn new(inner: Arc<dyn Events>, status: Arc<StatusCell>) -> Self {
        Self {
            inner,
            status,
            typing: Mutex::new(HashMap::new()),
        }
    }

    pub fn typing(&self, conversation_id: ConvId) -> Vec<UserId> {
        let Ok(typing) = self.typing.lock() else {
            return Vec::new();
        };
        typing
            .get(&conversation_id)
            .filter(|(_, at)| at.elapsed() < TYPING_FOR)
            .map(|(users, _)| users.clone())
            .unwrap_or_default()
    }

    fn note_typing(&self, conversation_id: ConvId, users: &[UserId]) {
        if let Ok(mut known) = self.typing.lock() {
            known.retain(|_, (_, at)| at.elapsed() < TYPING_FOR);
            known.insert(conversation_id, (users.to_vec(), Instant::now()));
        }
    }
}

impl Events for Tap {
    fn emit(&self, event: CoreEvent) {
        match &event {
            CoreEvent::Status(engine) => return self.status.absorb(engine),
            CoreEvent::Typing(typing) => self.note_typing(typing.conversation_id, &typing.users),
            _ => {}
        }
        self.inner.emit(event);
    }
}
