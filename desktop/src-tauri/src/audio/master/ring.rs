use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};

pub struct Ring {
    slots: Box<[AtomicU32]>,
    written: AtomicUsize,
    read: AtomicUsize,
}

impl Ring {
    pub fn new(capacity: usize) -> Self {
        Self {
            slots: (0..capacity.next_power_of_two())
                .map(|_| AtomicU32::new(0))
                .collect(),
            written: AtomicUsize::new(0),
            read: AtomicUsize::new(0),
        }
    }

    pub fn push(&self, samples: &[f32]) -> usize {
        let written = self.written.load(Ordering::Relaxed);
        let read = self.read.load(Ordering::Acquire);
        let free = self.slots.len() - written.wrapping_sub(read);
        let count = samples.len().min(free);
        let mask = self.slots.len() - 1;
        for (offset, sample) in samples[..count].iter().enumerate() {
            self.slots[written.wrapping_add(offset) & mask]
                .store(sample.to_bits(), Ordering::Relaxed);
        }
        self.written
            .store(written.wrapping_add(count), Ordering::Release);
        count
    }

    pub fn pop(&self, out: &mut [f32]) -> usize {
        let read = self.read.load(Ordering::Relaxed);
        let written = self.written.load(Ordering::Acquire);
        let count = out.len().min(written.wrapping_sub(read));
        let mask = self.slots.len() - 1;
        for (offset, sample) in out[..count].iter_mut().enumerate() {
            *sample = f32::from_bits(
                self.slots[read.wrapping_add(offset) & mask].load(Ordering::Relaxed),
            );
        }
        self.read.store(read.wrapping_add(count), Ordering::Release);
        count
    }

    pub fn clear(&self) {
        let written = self.written.load(Ordering::Acquire);
        self.read.store(written, Ordering::Release);
    }
}
