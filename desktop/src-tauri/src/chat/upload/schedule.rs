use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use sc_chat::outbox::Outbox;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{ChatResult, ConvId, MediaKind, Message, Millis, UploadState};
use tokio::time::Instant;
use uuid::Uuid;

use super::errors::backoff;
use super::post::{Posted, posted_from, ready, settles};

pub struct Queue {
    pub uploads: Vec<MediaUpload>,
    pub settle: Vec<MediaUpload>,
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

pub fn queued(store: &Arc<Store>, now: Millis) -> ChatResult<Queue> {
    let uploads = store.uploads()?;
    let mut posts = HashMap::new();
    let mut sending = HashSet::new();
    let mut settle = Vec::new();
    for album in grouped(uploads.clone()) {
        let first = album[0].clone();
        let done = ready(&album);
        if first.kind != MediaKind::Image {
            if done {
                settle.push(first);
            }
            continue;
        }
        let waiting = album
            .iter()
            .any(|upload| upload.state == UploadState::Uploaded);
        if !waiting && !done {
            continue;
        }
        let post = posted_from(pending_in(store, &mut posts, &first)?, &album);
        if waiting && !matches!(post, Posted::None) {
            sending.insert(first.album);
        }
        if done && settles(&post, &album, now) {
            settle.push(first);
        }
    }
    Ok(Queue {
        uploads,
        settle,
        sending,
    })
}

pub fn grouped(uploads: Vec<MediaUpload>) -> Vec<Vec<MediaUpload>> {
    let mut albums: Vec<Vec<MediaUpload>> = Vec::new();
    for upload in uploads {
        match albums
            .iter_mut()
            .find(|album| album[0].album == upload.album)
        {
            Some(album) => album.push(upload),
            None => albums.push(vec![upload]),
        }
    }
    albums
}

fn pending_in(
    store: &Arc<Store>,
    posts: &mut HashMap<ConvId, Vec<Message>>,
    first: &MediaUpload,
) -> ChatResult<Option<Message>> {
    let conversation_id = first.conversation_id;
    if !posts.contains_key(&conversation_id) {
        let pending = Outbox::new(store.clone()).pending(conversation_id)?;
        posts.insert(conversation_id, pending);
    }
    Ok(posts
        .get(&conversation_id)
        .and_then(|pending| pending.iter().find(|post| post.client_id == first.album))
        .cloned())
}

impl Rows {
    pub fn pick(&mut self, queue: &Queue) -> Option<MediaUpload> {
        let now = Instant::now();
        self.rows
            .retain(|id, _| queue.uploads.iter().any(|upload| upload.id == *id));
        queue
            .uploads
            .iter()
            .find(|upload| self.due(upload.id, now) && pickable(upload, queue))
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

    pub fn hold(&mut self, id: Uuid, most: Duration) {
        if let Some(row) = self.rows.get_mut(&id) {
            row.until = row.until.map(|until| until.min(Instant::now() + most));
        }
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

fn pickable(upload: &MediaUpload, queue: &Queue) -> bool {
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
