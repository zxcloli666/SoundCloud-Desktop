use sc_chat::DeliveryState;
use sc_chat::outbox::Outbox;
use uuid::Uuid;

use super::rig::Rig;

impl Rig {
    pub fn ack(&self, album: Uuid) {
        let outbox = Outbox::new(self.store());
        outbox.sent(album, 1, self.host.now_ms(), None).unwrap();
        self.uploads.kick();
    }

    pub fn refuse_send(&self, album: Uuid) {
        Outbox::new(self.store()).failed(album, None).unwrap();
        self.uploads.kick();
    }

    pub fn post_state(&self, album: Uuid) -> Option<DeliveryState> {
        Outbox::new(self.store())
            .pending(self.conversation)
            .unwrap()
            .into_iter()
            .find(|message| message.client_id == album)
            .map(|message| message.state)
    }
}
