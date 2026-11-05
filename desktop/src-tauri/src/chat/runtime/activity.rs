use std::time::{Duration, Instant};

use sc_chat::ConvId;

use super::Runtime;

const TYPING_EVERY: Duration = Duration::from_secs(3);

impl Runtime {
    pub fn may_type(&self, conversation_id: ConvId) -> bool {
        let Ok(mut sent) = self.typing_sent.lock() else {
            return false;
        };
        let now = Instant::now();
        sent.retain(|_, at| now.duration_since(*at) < TYPING_EVERY);
        if sent.contains_key(&conversation_id) {
            return false;
        }
        sent.insert(conversation_id, now);
        true
    }
}
