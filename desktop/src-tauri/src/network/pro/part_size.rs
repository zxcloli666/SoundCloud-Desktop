use std::sync::atomic::{AtomicUsize, Ordering};

pub const START_PART: usize = 32 * 1024;
pub const SMALLEST_PART: usize = 4 * 1024;
pub const GROW_AFTER: usize = 16;

pub struct PartSize {
    size: AtomicUsize,
    landed: AtomicUsize,
}

impl PartSize {
    pub const fn new() -> Self {
        Self {
            size: AtomicUsize::new(START_PART),
            landed: AtomicUsize::new(0),
        }
    }

    pub fn get(&self) -> usize {
        self.size.load(Ordering::Relaxed)
    }

    pub fn failed(&self, size: usize) {
        self.landed.store(0, Ordering::Relaxed);
        self.size
            .fetch_min((size / 2).max(SMALLEST_PART), Ordering::Relaxed);
    }

    pub fn landed(&self, size: usize, parts: usize) {
        if size != self.get() || size >= START_PART {
            return;
        }
        let landed = self.landed.fetch_add(parts, Ordering::Relaxed) + parts;
        if landed < GROW_AFTER {
            return;
        }
        self.landed.store(0, Ordering::Relaxed);
        let _ = self.size.compare_exchange(
            size,
            (size * 2).min(START_PART),
            Ordering::Relaxed,
            Ordering::Relaxed,
        );
    }
}

impl Default for PartSize {
    fn default() -> Self {
        Self::new()
    }
}
