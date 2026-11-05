use std::path::PathBuf;
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use sc_chat::api::{Api, Identity};
use sc_chat::channel::Channel;
use sc_chat::crypto::DeviceKeys;
use sc_chat::outbox::{Outbox, OutboxItem};
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::sc_chat_wire::proto::Envelope;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{ChatError, ConvId, ConversationKind, Millis, RichText, SendInput};
use tokio::task::JoinHandle;
use uuid::Uuid;

use super::world::{self, World};
use super::{fixtures, png};
use crate::chat::media_cache::MediaCache;
use crate::chat::runtime::SystemClock;
use crate::chat::upload::delete_queue::{DeleteQueue, Slot};
use crate::chat::upload::engine::{Routes, Uploads};
use crate::chat::upload::host::Host;
use crate::network::edge::{Hop, Tier};

pub const START: Millis = 1_762_200_000_000;
const MASTER: [u8; 32] = [7; 32];
const WAIT: Duration = Duration::from_secs(60);

pub struct TestHost {
    pub store: Mutex<Option<Arc<Store>>>,
    pub now: AtomicI64,
    pub sent: AtomicUsize,
    pub errors: Mutex<Vec<(Uuid, ChatError)>>,
}

impl Host for TestHost {
    fn store(&self) -> Option<Arc<Store>> {
        self.store.lock().unwrap().clone()
    }

    fn now_ms(&self) -> Millis {
        self.now.load(Ordering::SeqCst)
    }

    fn sent(&self) {
        self.sent.fetch_add(1, Ordering::SeqCst);
    }

    fn failed(&self, id: Uuid, error: &ChatError) {
        self.errors.lock().unwrap().push((id, error.clone()));
    }

    fn album_max(&self, room: bool) -> usize {
        if room { 4 } else { 10 }
    }
}

#[derive(Clone)]
pub enum Path {
    Relay(String),
    Pro(String),
}

pub struct Rig {
    pub world: Arc<World>,
    pub dir: PathBuf,
    pub host: Arc<TestHost>,
    pub uploads: Arc<Uploads>,
    pub cache: Arc<MediaCache>,
    pub conversation: ConvId,
    paths: Arc<Mutex<Vec<Path>>>,
    driver: Option<JoinHandle<()>>,
}

impl Rig {
    pub fn new(kind: ConversationKind) -> Self {
        let world = World::start();
        let dir = std::env::temp_dir().join(format!("chat-upload-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).unwrap();
        let conversation = Uuid::new_v4();
        let rig = Self::open(world, dir, conversation, Arc::default());
        let store = rig.store();
        store.set_me("100").unwrap();
        store
            .put_conversations(&[fixtures::summary(conversation, kind)])
            .unwrap();
        rig
    }

    fn open(
        world: Arc<World>,
        dir: PathBuf,
        conversation: ConvId,
        paths: Arc<Mutex<Vec<Path>>>,
    ) -> Self {
        let store = Arc::new(Store::open(&dir.join("chat.db"), &MASTER).unwrap());
        let host = Arc::new(TestHost {
            store: Mutex::new(Some(store)),
            now: AtomicI64::new(START),
            sent: AtomicUsize::new(0),
            errors: Mutex::new(Vec::new()),
        });
        let fake = Arc::new(world::Api(world.clone()));
        let api = Api::with_exchange(
            Arc::new(Channel::new(Arc::new(SystemClock))),
            fake.clone(),
            fake,
        );
        api.set_identity(Some(Identity {
            session_id: "session".into(),
            device_id: Uuid::new_v4(),
            keys: Arc::new(DeviceKeys::generate().unwrap()),
        }));
        let cache = Arc::new(MediaCache::open(&dir));
        let uploads = Arc::new(Uploads::routed(
            Arc::new(api),
            host.clone(),
            cache.clone(),
            routes(world.s3.clone(), paths.clone()),
        ));
        Self {
            world,
            dir,
            host,
            uploads,
            cache,
            conversation,
            paths,
            driver: None,
        }
    }

    pub fn route(&self, paths: Vec<Path>) {
        *self.paths.lock().unwrap() = paths;
    }

    pub fn relays(&self) {
        self.route(vec![Path::Relay(self.world.s3.clone())]);
    }

    pub fn restart(mut self) -> Self {
        self.stop();
        let world = self.world.clone();
        let dir = std::mem::take(&mut self.dir);
        Self::open(world, dir, self.conversation, self.paths.clone())
    }

    pub fn store(&self) -> Arc<Store> {
        self.host.store().unwrap()
    }

    pub fn sign_in(&self, me: &str) {
        let store = Arc::new(Store::open(&self.dir.join("chat.db"), &MASTER).unwrap());
        store.set_me(me).unwrap();
        store
            .put_conversations(&[fixtures::summary(
                self.conversation,
                ConversationKind::Group,
            )])
            .unwrap();
        *self.host.store.lock().unwrap() = Some(store);
    }

    pub fn queued_deletes(&self, account: &str) -> Vec<Uuid> {
        DeleteQueue::new(&self.dir).read(&Slot::Account(account.into()))
    }

    pub fn run(&mut self) {
        self.driver = Some(tokio::spawn(self.uploads.clone().run()));
    }

    pub fn stop(&mut self) {
        if let Some(driver) = self.driver.take() {
            driver.abort();
        }
    }

    pub fn now(&self) -> Millis {
        self.host.now.load(Ordering::SeqCst)
    }

    pub fn advance(&self, ms: Millis) {
        self.host.now.fetch_add(ms, Ordering::SeqCst);
    }

    pub fn image(&self, seed: u64) -> String {
        let path = self.dir.join(format!("source-{seed}.png"));
        std::fs::write(&path, png::noisy(720, 540, seed)).unwrap();
        path.to_string_lossy().into_owned()
    }

    pub fn uploads(&self) -> Vec<MediaUpload> {
        self.store().uploads().unwrap()
    }

    pub fn upload_files(&self) -> Vec<PathBuf> {
        std::fs::read_dir(self.dir.join("uploads"))
            .map(|entries| {
                entries
                    .filter_map(|entry| Some(entry.ok()?.path()))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn post(&self, text: &str) -> SendInput {
        SendInput {
            conversation_id: self.conversation,
            client_id: None,
            text: RichText {
                text: text.into(),
                spans: Vec::new(),
            },
            reply_to: None,
            embeds: Vec::new(),
            forward: None,
        }
    }

    pub fn outbox(&self) -> Vec<OutboxItem> {
        Outbox::new(self.store()).due(Millis::MAX, 100).unwrap()
    }

    pub fn due(&self) -> Vec<OutboxItem> {
        Outbox::new(self.store())
            .due(self.host.now_ms(), 100)
            .unwrap()
    }

    pub async fn until(&self, what: &str, done: impl Fn(&Rig) -> bool) {
        let started = Instant::now();
        while !done(self) {
            if started.elapsed() > WAIT {
                let calls = self.world.with(|state| state.calls.clone());
                let errors = self.host.errors.lock().unwrap().clone();
                panic!(
                    "timed out waiting for {what}: {:?} {calls:?} {errors:?}",
                    self.uploads()
                );
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    }
}

impl Drop for Rig {
    fn drop(&mut self) {
        self.stop();
        if !self.dir.as_os_str().is_empty() {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }
}

pub fn envelope(item: &OutboxItem) -> Envelope {
    Envelope::decode(item.envelope.as_slice()).unwrap()
}

fn routes(s3: String, paths: Arc<Mutex<Vec<Path>>>) -> Routes {
    Arc::new(move |url: &str| {
        paths
            .lock()
            .unwrap()
            .iter()
            .map(|path| match path {
                Path::Relay(via) => Hop {
                    url: url.replacen(&s3, via, 1),
                    tier: Tier::Relay,
                    origin: String::new(),
                },
                Path::Pro(node) => Hop {
                    url: node.clone(),
                    tier: Tier::Pro,
                    origin: String::new(),
                },
            })
            .collect()
    })
}
