use std::collections::{BTreeMap, VecDeque};
use std::sync::Mutex;

use backend_contracts::diag::{ErrorKind, MAX_CONTEXT_KEYS};
use backend_contracts::diag_fingerprint::fingerprint;
use serde::Deserialize;

use super::caps;
use super::trace;
use crate::app::log_sink::redact;

pub use backend_contracts::diag::ErrorEntry;

pub const CAPACITY: usize = 50;

#[derive(Clone, Debug, Deserialize)]
pub struct ErrorInput {
    pub kind: ErrorKind,
    pub message: String,
    pub stack: Option<String>,
    pub component_stack: Option<String>,
    pub trace: Option<String>,
    #[serde(default)]
    pub context: BTreeMap<String, String>,
}

static RING: Mutex<VecDeque<ErrorEntry>> = Mutex::new(VecDeque::new());

pub fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

pub fn entry_of(input: ErrorInput) -> ErrorEntry {
    let clean = |text: &str, max| caps::cut(&redact(text), max);
    let message = clean(&input.message, caps::MESSAGE);
    let stack = input.stack.map(|text| clean(&text, caps::STACK));
    let context: BTreeMap<String, String> = input
        .context
        .into_iter()
        .take(MAX_CONTEXT_KEYS)
        .map(|(key, value)| {
            (
                caps::cut(&key, caps::KEY),
                clean(&value, caps::CONTEXT_VALUE),
            )
        })
        .collect();
    ErrorEntry {
        at: now_iso(),
        kind: input.kind,
        fingerprint: fingerprint(input.kind, &message, stack.as_deref(), &context),
        message,
        stack,
        component_stack: input
            .component_stack
            .map(|text| clean(&text, caps::COMPONENT_STACK)),
        trace: input.trace.filter(|trace| trace::valid_trace(trace)),
        count: 1,
        context,
    }
}

pub fn record(entry: ErrorEntry) -> usize {
    let mut ring = RING.lock().unwrap_or_else(|poison| poison.into_inner());
    if let Some(known) = ring
        .iter_mut()
        .find(|known| known.fingerprint == entry.fingerprint)
    {
        known.count += 1;
        known.at = entry.at;
        return ring
            .iter()
            .position(|known| known.fingerprint == entry.fingerprint)
            .unwrap_or(0);
    }
    if ring.len() >= CAPACITY {
        ring.pop_front();
    }
    ring.push_back(entry);
    ring.len() - 1
}

pub fn all() -> Vec<ErrorEntry> {
    RING.lock()
        .unwrap_or_else(|poison| poison.into_inner())
        .iter()
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(message: &str) -> ErrorInput {
        ErrorInput {
            kind: ErrorKind::Render,
            message: message.to_string(),
            stack: None,
            component_stack: None,
            trace: Some("ab".repeat(16)),
            context: BTreeMap::new(),
        }
    }

    #[test]
    fn repeats_grow_the_count_and_the_ring_is_capped() {
        let first = entry_of(input("same 1"));
        record(first.clone());
        record(entry_of(input("same 2")));
        let known: Vec<_> = all()
            .into_iter()
            .filter(|entry| entry.fingerprint == first.fingerprint)
            .collect();
        assert_eq!(known.len(), 1);
        assert_eq!(known[0].count, 2);
        for number in 0..(CAPACITY + 10) {
            record(entry_of(input(&"m".repeat(number + 1))));
        }
        assert_eq!(all().len(), CAPACITY);
    }

    #[test]
    fn long_strings_and_contexts_are_cut() {
        let mut long = input(&"m".repeat(5000));
        long.stack = Some("s".repeat(9000));
        long.component_stack = Some("c".repeat(5000));
        for number in 0..15 {
            long.context
                .insert(format!("k{number:02}"), "v".repeat(500));
        }
        let entry = entry_of(long);
        assert_eq!(entry.message.chars().count(), caps::MESSAGE);
        assert_eq!(entry.stack.unwrap().chars().count(), caps::STACK);
        assert_eq!(
            entry.component_stack.unwrap().chars().count(),
            caps::COMPONENT_STACK
        );
        assert_eq!(entry.context.len(), MAX_CONTEXT_KEYS);
        assert!(
            entry
                .context
                .values()
                .all(|v| v.chars().count() == caps::CONTEXT_VALUE)
        );
    }

    #[test]
    fn only_well_formed_trace_ids_are_kept() {
        let entry = entry_of(input("t"));
        assert_eq!(entry.trace.unwrap(), "ab".repeat(16));
        let mut bad = input("t");
        bad.trace = Some("nope".to_string());
        assert!(entry_of(bad).trace.is_none());
    }
}
