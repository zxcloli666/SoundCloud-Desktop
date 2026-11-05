use std::collections::HashSet;

use sc_chat::UserId;

use super::Runtime;

impl Runtime {
    pub fn blocked(&self) -> HashSet<UserId> {
        self.blocked
            .read()
            .map(|blocked| blocked.clone())
            .unwrap_or_default()
    }

    pub fn note_blocked(&self, users: impl IntoIterator<Item = UserId>) {
        if let Ok(mut blocked) = self.blocked.write() {
            *blocked = users.into_iter().collect();
        }
    }

    pub fn set_blocked(&self, user_id: &str, on: bool) {
        let Ok(mut blocked) = self.blocked.write() else {
            return;
        };
        if on {
            blocked.insert(user_id.to_owned());
        } else {
            blocked.remove(user_id);
        }
    }

    pub(super) async fn refresh_blocked(&self) {
        if let Ok(settings) = self.api.settings().await {
            self.note_blocked(settings.blocked.into_iter().map(|user| user.user_id));
        }
    }
}
