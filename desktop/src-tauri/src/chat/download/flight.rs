use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::{Arc, Mutex};

use tokio::sync::oneshot;

type Waiters<K, T> = Mutex<HashMap<K, Vec<oneshot::Sender<T>>>>;

pub struct Flights<K, T> {
    waiting: Arc<Waiters<K, T>>,
}

impl<K, T> Default for Flights<K, T> {
    fn default() -> Self {
        Self {
            waiting: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl<K, T> Flights<K, T>
where
    K: Eq + Hash + Clone + Send + 'static,
    T: Clone + Send + 'static,
{
    pub async fn run<F>(&self, key: K, work: F) -> Option<T>
    where
        F: Future<Output = T> + Send + 'static,
    {
        let (done, outcome) = oneshot::channel();
        let leads = {
            let mut waiting = self.waiting.lock().ok()?;
            match waiting.get_mut(&key) {
                Some(waiters) => {
                    waiters.push(done);
                    false
                }
                None => {
                    waiting.insert(key.clone(), vec![done]);
                    true
                }
            }
        };
        if leads {
            let mut landing = Landing {
                waiting: self.waiting.clone(),
                key: Some(key),
            };
            tokio::spawn(async move {
                let result = work.await;
                for waiter in landing.take() {
                    let _ = waiter.send(result.clone());
                }
            });
        }
        outcome.await.ok()
    }
}

struct Landing<K: Eq + Hash, T> {
    waiting: Arc<Waiters<K, T>>,
    key: Option<K>,
}

impl<K: Eq + Hash, T> Landing<K, T> {
    fn take(&mut self) -> Vec<oneshot::Sender<T>> {
        let Some(key) = self.key.take() else {
            return Vec::new();
        };
        self.waiting
            .lock()
            .ok()
            .and_then(|mut waiting| waiting.remove(&key))
            .unwrap_or_default()
    }
}

impl<K: Eq + Hash, T> Drop for Landing<K, T> {
    fn drop(&mut self) {
        self.take();
    }
}
