use std::collections::HashMap;
use std::sync::Mutex;

use sc_chat::ConvId;
use tokio::sync::Notify;

#[derive(Default)]
pub struct Turns {
    rooms: Mutex<HashMap<ConvId, u64>>,
    moved: Notify,
}

impl Turns {
    pub fn take(&self, room: ConvId) -> u64 {
        let turn = match self.rooms.lock() {
            Ok(mut rooms) => {
                let turn = rooms.entry(room).or_default();
                *turn += 1;
                *turn
            }
            Err(_) => 0,
        };
        self.moved.notify_waiters();
        turn
    }

    pub fn holds(&self, room: ConvId, turn: u64) -> bool {
        self.rooms
            .lock()
            .is_ok_and(|rooms| rooms.get(&room) == Some(&turn))
    }

    pub async fn passed(&self, room: ConvId, turn: u64) {
        loop {
            let moved = self.moved.notified();
            tokio::pin!(moved);
            moved.as_mut().enable();
            if !self.holds(room, turn) {
                return;
            }
            moved.await;
        }
    }
}
