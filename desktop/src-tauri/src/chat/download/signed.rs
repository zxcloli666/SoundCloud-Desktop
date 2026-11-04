use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sc_chat::api::Api;
use sc_chat::api::wire::MediaUrl;
use sc_chat::media::URLS_MAX;
use sc_chat::media::queue::{self, PRESIGN_MARGIN_MS};
use sc_chat::{ChatError, ChatResult, ConvId};
use tokio::sync::oneshot;
use tokio::time::Instant;
use uuid::Uuid;

const GATHER: Duration = Duration::from_millis(15);
const KEPT_MAX: usize = 4096;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Link {
    Url(String),
    Deleted,
    Lost,
}

type Answer = oneshot::Sender<ChatResult<Link>>;

#[derive(Default)]
struct Batch {
    order: Vec<Uuid>,
    waiters: HashMap<Uuid, Vec<Answer>>,
}

#[derive(Default)]
struct Links {
    kept: HashMap<(ConvId, Uuid), (String, Instant)>,
    batches: HashMap<ConvId, Batch>,
}

pub struct Signer {
    api: Arc<Api>,
    links: Mutex<Links>,
}

impl Signer {
    pub fn new(api: Arc<Api>) -> Self {
        Self {
            api,
            links: Mutex::new(Links::default()),
        }
    }

    pub async fn link(self: &Arc<Self>, conv: ConvId, id: Uuid, renew: bool) -> ChatResult<Link> {
        let (answer, answered) = oneshot::channel();
        let starts = {
            let mut links = self.links.lock().map_err(|_| ChatError::Internal)?;
            match renew {
                true => {
                    links.kept.remove(&(conv, id));
                }
                false => {
                    if let Some((url, until)) = links.kept.get(&(conv, id))
                        && *until > Instant::now()
                    {
                        return Ok(Link::Url(url.clone()));
                    }
                }
            }
            let starts = !links.batches.contains_key(&conv);
            let batch = links.batches.entry(conv).or_default();
            if !batch.waiters.contains_key(&id) {
                batch.order.push(id);
            }
            batch.waiters.entry(id).or_default().push(answer);
            starts
        };
        if starts {
            let flusher = Flusher {
                signer: self.clone(),
                conv,
                done: false,
            };
            tokio::spawn(flusher.run());
        }
        answered.await.unwrap_or(Err(ChatError::Internal))
    }

    fn next_chunk(&self, conv: ConvId) -> Option<(Vec<Uuid>, Vec<Vec<Answer>>)> {
        let mut links = self.links.lock().ok()?;
        let batch = links.batches.get_mut(&conv)?;
        if batch.order.is_empty() {
            links.batches.remove(&conv);
            return None;
        }
        let take = batch.order.len().min(URLS_MAX);
        let ids = batch.order.drain(..take).collect::<Vec<_>>();
        let waiters = ids
            .iter()
            .map(|id| batch.waiters.remove(id).unwrap_or_default())
            .collect();
        Some((ids, waiters))
    }

    fn keep(&self, conv: ConvId, links: &[(Uuid, ChatResult<Link>)], expires_in_s: u32) {
        let lasts = i64::from(expires_in_s) * 1_000 - PRESIGN_MARGIN_MS;
        if lasts <= 0 {
            return;
        }
        let until = Instant::now() + Duration::from_millis(lasts as u64);
        let Ok(mut kept) = self.links.lock() else {
            return;
        };
        if kept.kept.len() >= KEPT_MAX {
            let now = Instant::now();
            kept.kept.retain(|_, (_, until)| *until > now);
        }
        if kept.kept.len() >= KEPT_MAX {
            kept.kept.clear();
        }
        for (id, link) in links {
            if let Ok(Link::Url(url)) = link {
                kept.kept.insert((conv, *id), (url.clone(), until));
            }
        }
    }
}

struct Flusher {
    signer: Arc<Signer>,
    conv: ConvId,
    done: bool,
}

impl Flusher {
    async fn run(mut self) {
        tokio::time::sleep(GATHER).await;
        while let Some((ids, waiters)) = self.signer.next_chunk(self.conv) {
            let answered = queue::urls(&self.signer.api, Some(self.conv), &ids).await;
            match answered {
                Ok(answer) => {
                    let links = matched(&ids, answer.items);
                    self.signer.keep(self.conv, &links, answer.expires_in_s);
                    for ((_, link), waiting) in links.into_iter().zip(waiters) {
                        for waiter in waiting {
                            let _ = waiter.send(link.clone());
                        }
                    }
                }
                Err(error) => {
                    for waiter in waiters.into_iter().flatten() {
                        let _ = waiter.send(Err(error.clone()));
                    }
                }
            }
        }
        self.done = true;
    }
}

impl Drop for Flusher {
    fn drop(&mut self) {
        if self.done {
            return;
        }
        if let Ok(mut links) = self.signer.links.lock() {
            links.batches.remove(&self.conv);
        }
    }
}

fn matched(ids: &[Uuid], items: Vec<MediaUrl>) -> Vec<(Uuid, ChatResult<Link>)> {
    let mut by_id = HashMap::with_capacity(items.len());
    for item in items {
        let (id, link) = match item {
            MediaUrl::Ok { id, url } => (id, Link::Url(url)),
            MediaUrl::Deleted { id } => (id, Link::Deleted),
            MediaUrl::Lost { id } => (id, Link::Lost),
        };
        by_id.insert(id, link);
    }
    ids.iter()
        .map(|id| (*id, by_id.remove(id).ok_or(ChatError::Protocol)))
        .collect()
}
