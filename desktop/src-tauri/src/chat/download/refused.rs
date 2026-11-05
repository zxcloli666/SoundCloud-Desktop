use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use tokio::time::Instant;
use uuid::Uuid;

use super::Part;

const KEEP: Duration = Duration::from_secs(600);
const MAX: usize = 1024;

#[derive(Default)]
pub struct Refused {
    until: Mutex<HashMap<(Uuid, Part), Instant>>,
}

impl Refused {
    pub fn mark(&self, media_id: Uuid, part: Part) {
        let Ok(mut until) = self.until.lock() else {
            return;
        };
        let now = Instant::now();
        if until.len() >= MAX {
            until.retain(|_, at| *at > now);
        }
        if until.len() < MAX {
            until.insert((media_id, part), now + KEEP);
        }
    }

    pub fn left(&self, media_id: Uuid) -> Option<Duration> {
        let until = self.until.lock().ok()?;
        let now = Instant::now();
        [Part::Thumb, Part::Image]
            .into_iter()
            .filter_map(|part| until.get(&(media_id, part)))
            .filter(|at| **at > now)
            .map(|at| *at - now)
            .max()
    }

    pub fn forget(&self, media_id: Uuid) {
        if let Ok(mut until) = self.until.lock() {
            until.retain(|(id, _), _| *id != media_id);
        }
    }

    pub fn holds(&self, media_id: Uuid, part: Part) -> bool {
        self.until.lock().is_ok_and(|until| {
            until
                .get(&(media_id, part))
                .is_some_and(|at| *at > Instant::now())
        })
    }
}
