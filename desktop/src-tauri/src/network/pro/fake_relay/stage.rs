use std::ops::Range;
use std::time::Instant;

use serde_json::{Value, json};

pub struct Stage {
    pub bytes: Vec<u8>,
    covered: Vec<Range<usize>>,
    pub touched: Instant,
}

impl Stage {
    pub fn new(size: usize) -> Self {
        Self {
            bytes: vec![0; size],
            covered: Vec::new(),
            touched: Instant::now(),
        }
    }

    pub fn write(&mut self, at: usize, chunk: &[u8]) {
        self.bytes[at..at + chunk.len()].copy_from_slice(chunk);
        let mut covered = std::mem::take(&mut self.covered);
        covered.push(at..at + chunk.len());
        self.covered = merged(covered);
    }

    pub fn forget(&mut self, len: usize) {
        self.covered = self
            .covered
            .iter()
            .map(|range| range.start.max(len)..range.end)
            .filter(|range| range.start < range.end)
            .collect();
    }

    pub fn missing(&self) -> Vec<[usize; 2]> {
        let mut gaps = Vec::new();
        let mut at = 0;
        for range in &self.covered {
            if range.start > at {
                gaps.push([at, range.start]);
            }
            at = at.max(range.end);
        }
        if at < self.bytes.len() {
            gaps.push([at, self.bytes.len()]);
        }
        gaps
    }

    pub fn answer(&self, id: &str) -> Value {
        json!({ "id": id, "size": self.bytes.len(), "missing": self.missing() })
    }
}

fn merged(mut ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    ranges.sort_by_key(|range| range.start);
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
            _ => merged.push(range),
        }
    }
    merged
}
