use std::path::PathBuf;
use std::sync::Arc;

use sc_chat::api::Api;
use sc_chat::media::MediaWorker;
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::{ChatError, ChatResult, ConvId};
use uuid::Uuid;

use super::flight::Flights;
use super::get::{self, Got};
use super::object::Object;
use super::open::{self, Opened};
use super::refused::Refused;
use super::signed::{Link, Signer};
use super::{Fetched, Gone, MediaState, Part};
use crate::chat::media_cache::MediaCache;
use crate::network::edge::{self, Hop};

pub type Routes = Arc<dyn Fn(&str) -> Vec<Hop> + Send + Sync>;
pub type Notice = Arc<dyn Fn(MediaState) + Send + Sync>;
type Key = (ConvId, Uuid, Part);

const UPLOADS: &str = "uploads";

pub struct Downloads {
    pub(super) cache: Arc<MediaCache>,
    pub(super) worker: MediaWorker,
    pub(super) uploads: PathBuf,
    pub(super) signer: Arc<Signer>,
    routes: Routes,
    notice: Notice,
    refused: Refused,
    flights: Flights<Key, ChatResult<Fetched>>,
}

enum Remote {
    Body(Vec<u8>),
    Gone(Gone),
    Denied,
    Missing,
    Refused,
}

impl Downloads {
    pub fn new(api: Arc<Api>, cache: Arc<MediaCache>, notice: Notice) -> Self {
        Self::routed(api, cache, notice, Arc::new(|url: &str| edge::plan(url)))
    }

    pub fn routed(api: Arc<Api>, cache: Arc<MediaCache>, notice: Notice, routes: Routes) -> Self {
        Self {
            uploads: cache.chat_dir().join(UPLOADS),
            cache,
            worker: MediaWorker::default(),
            signer: Arc::new(Signer::new(api)),
            routes,
            notice,
            refused: Refused::default(),
            flights: Flights::default(),
        }
    }

    pub async fn fetch(
        self: &Arc<Self>,
        conversation_id: ConvId,
        media_id: Uuid,
        attachment: Attachment,
        part: Part,
    ) -> ChatResult<Fetched> {
        let Some(object) = Object::of(conversation_id, attachment, part) else {
            return Ok(self.tell(conversation_id, media_id, Fetched::Lost));
        };
        let this = self.clone();
        let key = (conversation_id, media_id, object.part);
        self.flights
            .run(key, async move {
                let fetched = this.fetch_once(object).await?;
                Ok::<_, ChatError>(this.tell(conversation_id, media_id, fetched))
            })
            .await
            .unwrap_or(Err(ChatError::Internal))
    }

    pub fn tell(&self, conversation_id: ConvId, media_id: Uuid, fetched: Fetched) -> Fetched {
        let state = match fetched {
            Fetched::Deleted => Gone::Deleted,
            Fetched::Lost => Gone::Lost,
            Fetched::Image(_) => return fetched,
        };
        (self.notice)(MediaState {
            conversation_id,
            media_id,
            state,
        });
        fetched
    }

    async fn fetch_once(&self, object: Object) -> ChatResult<Fetched> {
        if let Some(cipher) = self.cached(&object).await {
            match self.open(&object, cipher).await {
                Opened::Image(picture) => return Ok(Fetched::Image(picture)),
                Opened::Busy => return Err(busy()),
                Opened::Bad => self.drop_part(&object).await,
            }
        }
        if self.refused.holds(object.media_id, object.part) {
            return Ok(Fetched::Lost);
        }
        let cipher = match self.download(&object).await? {
            Remote::Body(cipher) => cipher,
            Remote::Gone(gone) => return Ok(self.gone(&object, gone).await),
            Remote::Denied => return Ok(Fetched::Deleted),
            Remote::Missing => {
                self.drop_part(&object).await;
                return Ok(Fetched::Lost);
            }
            Remote::Refused => {
                self.refused.mark(object.media_id, object.part);
                return Ok(Fetched::Lost);
            }
        };
        self.keep(&object, cipher.clone()).await;
        match self.open(&object, cipher).await {
            Opened::Image(picture) => Ok(Fetched::Image(picture)),
            Opened::Busy => Err(busy()),
            Opened::Bad => {
                self.drop_part(&object).await;
                self.refused.mark(object.media_id, object.part);
                Ok(Fetched::Lost)
            }
        }
    }

    async fn download(&self, object: &Object) -> ChatResult<Remote> {
        let mut renewed = false;
        loop {
            let link = self
                .signer
                .link(object.conversation_id, object.remote_id, renewed)
                .await;
            let url = match link {
                Ok(Link::Url(url)) => url,
                Ok(Link::Deleted) => return Ok(Remote::Gone(Gone::Deleted)),
                Err(ChatError::NotMember | ChatError::NotFound) => return Ok(Remote::Denied),
                Ok(Link::Lost) => return Ok(Remote::Gone(Gone::Lost)),
                Err(error) => return Err(retryable(error)),
            };
            let hops = (self.routes)(&url);
            match get::get(&hops, object.expect()).await {
                Got::Body(cipher) => return Ok(Remote::Body(cipher)),
                Got::Missing | Got::Unsigned if !renewed => renewed = true,
                Got::Missing => return Ok(Remote::Missing),
                Got::Refused => return Ok(Remote::Refused),
                Got::Unsigned | Got::Broken => return Err(ChatError::Offline),
            }
        }
    }

    async fn open(&self, object: &Object, cipher: Vec<u8>) -> Opened {
        let attachment = object.attachment.clone();
        open::sealed(self.worker.clone(), cipher, attachment, object.part).await
    }

    async fn cached(&self, object: &Object) -> Option<Vec<u8>> {
        let cache = self.cache.clone();
        let (media_id, part) = (object.media_id, object.part);
        tokio::task::spawn_blocking(move || cache.get(media_id, part))
            .await
            .ok()?
            .ok()?
    }

    async fn keep(&self, object: &Object, cipher: Vec<u8>) {
        let cache = self.cache.clone();
        let (media_id, part) = (object.media_id, object.part);
        let _ = tokio::task::spawn_blocking(move || cache.put(media_id, part, &cipher)).await;
    }

    async fn drop_part(&self, object: &Object) {
        let cache = self.cache.clone();
        let (media_id, part) = (object.media_id, object.part);
        let _ = tokio::task::spawn_blocking(move || cache.drop_part(media_id, part)).await;
    }

    async fn gone(&self, object: &Object, gone: Gone) -> Fetched {
        let cache = self.cache.clone();
        let media_id = object.media_id;
        let _ = tokio::task::spawn_blocking(move || cache.forget(media_id)).await;
        match gone {
            Gone::Deleted => Fetched::Deleted,
            Gone::Lost => Fetched::Lost,
        }
    }
}

fn retryable(error: ChatError) -> ChatError {
    match error {
        ChatError::NotReady
        | ChatError::ReloginRequired
        | ChatError::DeviceRevoked
        | ChatError::Invalid => error,
        _ => ChatError::Offline,
    }
}

fn busy() -> ChatError {
    ChatError::Busy { retry_ms: 1_000 }
}
