use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use sc_chat::store::{MediaUpload, Store};
use sc_chat::{ChatResult, MediaKind, UploadState};
use tokio::time::Instant;
use uuid::Uuid;

use super::errors::backoff;
use super::post::pending_post;

pub struct Queue {
    pub uploads: Vec<MediaUpload>,
    sending: HashSet<Uuid>,
}

#[derive(Default)]
pub struct Rows {
    rows: HashMap<Uuid, Row>,
}

#[derive(Default)]
struct Row {
    failures: u32,
    refusals: u32,
    until: Option<Instant>,
}

pub fn queued(store: &Arc<Store>) -> ChatResult<Queue> {
    let uploads = store.uploads()?;
    let waiting: HashSet<_> = uploads
        .iter()
        .filter(|upload| upload.kind == MediaKind::Image && upload.state == UploadState::Uploaded)
        .map(|upload| (upload.conversation_id, upload.album))
        .collect();
    let mut sending = HashSet::new();
    for (conversation_id, album) in waiting {
        if pending_post(store, conversation_id, album)?.is_some() {
            sending.insert(album);
        }
    }
    Ok(Queue { uploads, sending })
}

impl Rows {
    pub fn pick(&mut self, queue: &Queue) -> Option<MediaUpload> {
        let now = Instant::now();
        self.rows
            .retain(|id, _| queue.uploads.iter().any(|upload| upload.id == *id));
        queue
            .uploads
            .iter()
            .find(|upload| self.due(upload.id, now) && ready(upload, queue))
            .cloned()
    }

    pub fn next_wake(&self) -> Option<Duration> {
        let now = Instant::now();
        self.rows
            .values()
            .filter_map(|row| row.until)
            .filter(|until| *until > now)
            .min()
            .map(|until| until - now)
    }

    pub fn wake(&mut self) {
        for row in self.rows.values_mut() {
            row.until = None;
        }
    }

    pub fn ok(&mut self, id: Uuid) {
        if let Some(row) = self.rows.get_mut(&id) {
            row.failures = 0;
            row.until = None;
        }
    }

    pub fn failed(&mut self, id: Uuid, wait: Duration) {
        let row = self.rows.entry(id).or_default();
        row.failures += 1;
        row.until = Some(Instant::now() + wait.max(backoff(row.failures)));
    }

    pub fn refused(&mut self, id: Uuid) -> u32 {
        let row = self.rows.entry(id).or_default();
        row.refusals += 1;
        row.refusals
    }

    pub fn forget(&mut self, id: Uuid) {
        self.rows.remove(&id);
    }

    fn due(&self, id: Uuid, now: Instant) -> bool {
        self.rows
            .get(&id)
            .and_then(|row| row.until)
            .is_none_or(|until| until <= now)
    }
}

fn ready(upload: &MediaUpload, queue: &Queue) -> bool {
    match upload.state {
        UploadState::Committed | UploadState::Failed => false,
        UploadState::Uploaded if upload.kind == MediaKind::Image => {
            queue.sending.contains(&upload.album)
                && queue
                    .uploads
                    .iter()
                    .filter(|other| other.album == upload.album)
                    .all(|other| {
                        matches!(other.state, UploadState::Uploaded | UploadState::Committed)
                    })
        }
        _ => true,
    }
}
