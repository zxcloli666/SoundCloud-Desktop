use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use sc_chat::channel::{BUSY_RETRY_MS, Channel, InnerAnswer};
use sc_chat::crypto::DeviceKeys;
use sc_chat::sc_chat_wire::proto::Pow;
use sc_chat::{ChatError, ChatResult, Clock, KeyStore, Millis, Tier, Transport, async_trait};

use super::exchange::{Call, Miss, Signer, attempt, over_tiers};
use super::node::{Node, Nodes};
use super::{pow, wire};

const HOLD_FOR: Duration = Duration::from_secs(20 * 60);
const SOLVE_ROUNDS: usize = 3;

pub struct Lane {
    channel: Channel,
    last: Mutex<Option<Tier>>,
    held: Mutex<HashMap<String, Held>>,
    loading: tokio::sync::Mutex<()>,
    solving: Mutex<Arc<AtomicBool>>,
}

struct Held {
    signer: Arc<Signer>,
    node: Node,
    since: Instant,
}

impl Lane {
    pub fn new() -> Self {
        Self::with_channel(Channel::new(Arc::new(WallClock)))
    }

    pub fn with_channel(channel: Channel) -> Self {
        Self {
            channel,
            last: Mutex::new(None),
            held: Mutex::new(HashMap::new()),
            loading: tokio::sync::Mutex::new(()),
            solving: Mutex::new(Arc::new(AtomicBool::new(false))),
        }
    }

    pub async fn send(
        &self,
        nodes: &Nodes,
        order: &[Node],
        signer: &Signer,
        call: &Call,
        checking: &(dyn Fn(bool) + Sync),
    ) -> ChatResult<(Node, InnerAnswer)> {
        let mut missed = ChatError::Offline;
        for node in order {
            let transport = nodes.transport(*node);
            match self.ask(transport, signer, call, checking).await {
                Ok(answer) => return Ok((*node, answer)),
                Err(Miss::Fatal(error)) => return Err(error),
                Err(Miss::Tier(error)) => missed = error,
            }
        }
        Err(missed)
    }

    pub fn cancel(&self) {
        let mut solving = lock(&self.solving);
        solving.store(true, Ordering::Relaxed);
        *solving = Arc::new(AtomicBool::new(false));
    }

    async fn ask(
        &self,
        transport: &dyn Transport,
        signer: &Signer,
        call: &Call,
        checking: &(dyn Fn(bool) + Sync),
    ) -> Result<InnerAnswer, Miss> {
        let mut proof = None;
        let mut solved = 0;
        loop {
            let answer = self.round(transport, signer, call, proof.as_ref()).await?;
            let Some((seed, effort)) = wire::pow_ticket(&answer) else {
                return Ok(answer);
            };
            if solved == SOLVE_ROUNDS {
                return Err(Miss::Fatal(ChatError::Busy {
                    retry_ms: BUSY_RETRY_MS,
                }));
            }
            solved += 1;
            let cancel = lock(&self.solving).clone();
            checking(true);
            let found = pow::prove(signer, &call.inner.path, seed, effort, cancel).await;
            checking(false);
            proof = Some(found.map_err(Miss::Fatal)?);
        }
    }

    async fn round(
        &self,
        transport: &dyn Transport,
        signer: &Signer,
        call: &Call,
        proof: Option<&Pow>,
    ) -> Result<InnerAnswer, Miss> {
        let order = tier_order(transport.tiers(), *lock(&self.last));
        let (tier, answer) = over_tiers(order, |tier| {
            attempt(&self.channel, transport, signer, call, proof, tier)
        })
        .await?;
        *lock(&self.last) = Some(tier);
        Ok(answer)
    }

    pub async fn signer(&self, store: Arc<dyn KeyStore>) -> ChatResult<Arc<Signer>> {
        let _one_at_a_time = self.loading.lock().await;
        let (device_id, keys) =
            tokio::task::spawn_blocking(move || DeviceKeys::load_or_create(store.as_ref()))
                .await
                .map_err(|_| ChatError::Keychain)??;
        Ok(Arc::new(Signer { device_id, keys }))
    }

    pub fn hold(&self, request_id: &str, signer: Arc<Signer>, node: Node) {
        let mut held = lock(&self.held);
        held.retain(|_, entry| entry.since.elapsed() < HOLD_FOR);
        held.insert(
            request_id.to_owned(),
            Held {
                signer,
                node,
                since: Instant::now(),
            },
        );
    }

    pub fn held(&self, request_id: &str) -> Option<(Arc<Signer>, Node)> {
        lock(&self.held)
            .get(request_id)
            .map(|entry| (entry.signer.clone(), entry.node))
    }

    pub fn release(&self, request_id: &str) {
        lock(&self.held).remove(request_id);
    }

    pub fn release_all(&self) {
        lock(&self.held).clear();
    }
}

pub fn tier_order(tiers: Vec<Tier>, last: Option<Tier>) -> Vec<Tier> {
    let mut order = tiers;
    if let Some(at) = last.and_then(|last| order.iter().position(|tier| *tier == last)) {
        order[..=at].rotate_right(1);
    }
    order
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

struct WallClock;

#[async_trait]
impl Clock for WallClock {
    fn now_ms(&self) -> Millis {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|since| Millis::try_from(since.as_millis()).unwrap_or(Millis::MAX))
            .unwrap_or_default()
    }

    async fn sleep(&self, ms: u64) {
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }
}
