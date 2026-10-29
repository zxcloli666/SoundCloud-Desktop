use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};

use super::errors::ErrorEntry;

const FILE: &str = "diag_queue.json";
const CAPACITY: usize = 200;
const MAX_PER_POST: usize = 50;

static ENABLED: AtomicBool = AtomicBool::new(true);
static STATE: Mutex<Option<Queue>> = Mutex::new(None);

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Delivery {
    Sent,
    Rejected,
    Failed,
}

pub struct Queue {
    path: PathBuf,
    items: Vec<ErrorEntry>,
}

impl Queue {
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(FILE);
        let items = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self { path, items }
    }

    pub fn add(&mut self, entry: ErrorEntry) {
        if let Some(known) = self
            .items
            .iter_mut()
            .find(|known| known.fingerprint == entry.fingerprint)
        {
            known.count += entry.count;
            known.at = entry.at;
        } else {
            if self.items.len() >= CAPACITY {
                self.items.remove(0);
            }
            self.items.push(entry);
        }
        self.save();
    }

    pub fn clear(&mut self) {
        self.items.clear();
        self.save();
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn next_batch(&self) -> Vec<ErrorEntry> {
        self.items.iter().take(MAX_PER_POST).cloned().collect()
    }

    pub fn settle(&mut self, delivery: Delivery, sent: usize) {
        if delivery != Delivery::Failed {
            self.items.drain(..sent.min(self.items.len()));
            self.save();
        }
    }

    fn save(&self) {
        let bytes = serde_json::to_vec(&self.items).unwrap_or_default();
        let tmp = self.path.with_extension("tmp");
        if std::fs::write(&tmp, bytes).is_ok() && std::fs::rename(&tmp, &self.path).is_err() {
            let _ = std::fs::remove_file(&tmp);
        }
    }
}

fn held() -> MutexGuard<'static, Option<Queue>> {
    STATE.lock().unwrap_or_else(|poison| poison.into_inner())
}

pub fn start(dir: &Path) {
    *held() = Some(Queue::load(dir));
}

pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::Relaxed);
    if !enabled && let Some(queue) = held().as_mut() {
        queue.clear();
    }
}

pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

pub fn push(entry: ErrorEntry) -> usize {
    if !enabled() {
        return 0;
    }
    let mut guard = held();
    let Some(queue) = guard.as_mut() else {
        return 0;
    };
    queue.add(entry);
    queue.len()
}

pub fn batch() -> Vec<ErrorEntry> {
    if !enabled() {
        return Vec::new();
    }
    held().as_ref().map(Queue::next_batch).unwrap_or_default()
}

pub fn settle_batch(delivery: Delivery, sent: usize) {
    if let Some(queue) = held().as_mut() {
        queue.settle(delivery, sent);
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    fn entry(fingerprint: &str) -> ErrorEntry {
        ErrorEntry {
            at: "2026-10-29T10:00:00.000Z".into(),
            kind: "render".into(),
            message: "m".into(),
            stack: None,
            component_stack: None,
            trace: None,
            fingerprint: fingerprint.into(),
            count: 1,
            context: BTreeMap::new(),
        }
    }

    fn temp() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("scd-queue-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn the_queue_dedupes_caps_and_persists() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        queue.add(entry("same"));
        queue.add(entry("same"));
        assert_eq!(queue.len(), 1);
        assert_eq!(queue.next_batch()[0].count, 2);
        for number in 0..(CAPACITY + 20) {
            queue.add(entry(&format!("fp{number}")));
        }
        assert_eq!(queue.len(), CAPACITY);
        assert_eq!(Queue::load(&dir).len(), CAPACITY);
        assert_eq!(queue.next_batch().len(), MAX_PER_POST);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn failures_keep_events_and_answers_drop_them() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        for number in 0..5 {
            queue.add(entry(&format!("fp{number}")));
        }
        queue.settle(Delivery::Failed, 5);
        assert_eq!(queue.len(), 5);
        queue.settle(Delivery::Rejected, 2);
        assert_eq!(queue.len(), 3);
        queue.settle(Delivery::Sent, 3);
        assert_eq!(queue.len(), 0);
        assert_eq!(Queue::load(&dir).len(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
