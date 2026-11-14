use std::sync::Arc;
use std::sync::atomic::Ordering;

use super::Master;

pub struct Reference {
    master: Arc<Master>,
}

impl Reference {
    pub(super) fn new(master: Arc<Master>) -> Self {
        Self { master }
    }

    pub fn sample_rate(&self) -> u32 {
        self.master.reference_rate.load(Ordering::Relaxed)
    }

    pub fn read(&mut self, out: &mut [f32]) -> usize {
        match self.master.reference.get() {
            Some(ring) => ring.pop(out),
            None => 0,
        }
    }
}

impl Drop for Reference {
    fn drop(&mut self) {
        self.master.listening.store(false, Ordering::Release);
    }
}
