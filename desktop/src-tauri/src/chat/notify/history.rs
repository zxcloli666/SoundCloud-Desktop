use std::collections::{HashMap, HashSet};

use sc_chat::{ConvId, DeviceId, Message, Millis, Seq};

pub const OPEN_WITHIN_MS: Millis = 10_000;
pub const ONE_PER_CHAT_MS: Millis = 5_000;

#[derive(Default)]
pub struct History {
    seen: HashMap<ConvId, Seq>,
    shown: HashMap<ConvId, Millis>,
    devices: HashSet<DeviceId>,
    open: Option<(ConvId, Millis)>,
}

impl History {
    pub fn see(&mut self, conversation_id: ConvId, messages: &[Message]) -> Seq {
        let before = self.seen.get(&conversation_id).copied().unwrap_or(0);
        let newest = messages.iter().filter_map(|message| message.seq).max();
        if let Some(newest) = newest.filter(|newest| *newest > before) {
            self.seen.insert(conversation_id, newest);
        }
        before
    }

    pub fn recently_shown(&self, conversation_id: ConvId, now: Millis) -> bool {
        self.shown
            .get(&conversation_id)
            .is_some_and(|at| now - at < ONE_PER_CHAT_MS)
    }

    pub fn shown(&mut self, conversation_id: ConvId, now: Millis) {
        self.shown.insert(conversation_id, now);
        self.open = Some((conversation_id, now));
    }

    pub fn first_alert(&mut self, device_id: DeviceId) -> bool {
        self.devices.insert(device_id)
    }

    pub fn forget_open(&mut self) {
        self.open = None;
    }

    pub fn take_open(&mut self, now: Millis) -> Option<ConvId> {
        let (conversation_id, at) = self.open.take()?;
        (now - at <= OPEN_WITHIN_MS).then_some(conversation_id)
    }
}
