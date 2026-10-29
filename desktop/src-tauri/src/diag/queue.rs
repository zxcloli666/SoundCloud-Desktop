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

#[derive(Default, serde::Serialize, serde::Deserialize)]
struct Stored {
    items: Vec<ErrorEntry>,
    in_flight: Vec<ErrorEntry>,
}

pub struct Queue {
    path: PathBuf,
    items: Vec<ErrorEntry>,
    in_flight: Vec<ErrorEntry>,
}

impl Queue {
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(FILE);
        let stored: Stored = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        let mut queue = Self {
            path,
            items: stored.items,
            in_flight: stored.in_flight,
        };
        queue.return_in_flight();
        queue
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
        self.in_flight.clear();
        self.save();
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn next_batch(&mut self) -> Vec<ErrorEntry> {
        if !self.in_flight.is_empty() {
            return Vec::new();
        }
        let take = self.items.len().min(MAX_PER_POST);
        self.in_flight = self.items.drain(..take).collect();
        self.save();
        self.in_flight.clone()
    }

    pub fn settle(&mut self, delivery: Delivery) {
        match delivery {
            Delivery::Sent | Delivery::Rejected => self.in_flight.clear(),
            Delivery::Failed => self.return_in_flight(),
        }
        self.save();
    }

    fn return_in_flight(&mut self) {
        let mut older = Vec::new();
        for entry in std::mem::take(&mut self.in_flight) {
            match self
                .items
                .iter_mut()
                .find(|known| known.fingerprint == entry.fingerprint)
            {
                Some(known) => known.count += entry.count,
                None => older.push(entry),
            }
        }
        older.append(&mut self.items);
        self.items = older;
        let extra = self.items.len().saturating_sub(CAPACITY);
        self.items.drain(..extra);
    }

    fn save(&self) {
        let stored = serde_json::json!({ "items": self.items, "in_flight": self.in_flight });
        let bytes = serde_json::to_vec(&stored).unwrap_or_default();
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
    held().as_mut().map(Queue::next_batch).unwrap_or_default()
}

pub fn settle_batch(delivery: Delivery) {
    if let Some(queue) = held().as_mut() {
        queue.settle(delivery);
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
        assert_eq!(queue.items[0].count, 2);
        for number in 0..(CAPACITY + 20) {
            queue.add(entry(&format!("fp{number}")));
        }
        assert_eq!(queue.len(), CAPACITY);
        assert_eq!(Queue::load(&dir).len(), CAPACITY);
        assert_eq!(queue.next_batch().len(), MAX_PER_POST);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn answers_drop_the_batch_and_a_second_batch_waits() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        for number in 0..5 {
            queue.add(entry(&format!("fp{number}")));
        }
        assert_eq!(queue.next_batch().len(), 5);
        assert_eq!(queue.len(), 0);
        queue.add(entry("late"));
        assert!(queue.next_batch().is_empty());
        queue.settle(Delivery::Rejected);
        assert_eq!(queue.len(), 1);
        assert_eq!(queue.next_batch().len(), 1);
        queue.settle(Delivery::Sent);
        assert_eq!(queue.len(), 0);
        assert!(queue.next_batch().is_empty());
        assert_eq!(Queue::load(&dir).len(), 0);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failed_batch_returns_with_counts_merged_during_flight() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        queue.add(entry("a"));
        queue.add(entry("b"));
        queue.next_batch();
        queue.add(entry("a"));
        queue.add(entry("c"));
        queue.settle(Delivery::Failed);
        let fingerprints: Vec<&str> = queue.items.iter().map(|e| e.fingerprint.as_str()).collect();
        assert_eq!(fingerprints, ["b", "a", "c"]);
        assert_eq!(queue.items[1].count, 2);
        assert_eq!(queue.items[0].count, 1);
        assert!(queue.next_batch().len() == 3);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn the_cap_during_flight_keeps_the_batch_intact() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        for number in 0..MAX_PER_POST {
            queue.add(entry(&format!("old{number}")));
        }
        queue.next_batch();
        for number in 0..(CAPACITY + 10) {
            queue.add(entry(&format!("new{number}")));
        }
        assert_eq!(queue.len(), CAPACITY);
        queue.settle(Delivery::Sent);
        assert_eq!(queue.len(), CAPACITY);
        assert_eq!(queue.items[0].fingerprint, "new10");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_crash_during_flight_puts_the_batch_back() {
        let dir = temp();
        let mut queue = Queue::load(&dir);
        queue.add(entry("a"));
        queue.add(entry("b"));
        queue.next_batch();
        queue.add(entry("b"));
        let restored = Queue::load(&dir);
        assert_eq!(restored.len(), 2);
        assert!(restored.in_flight.is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
