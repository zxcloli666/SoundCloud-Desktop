use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

const MAX_BUFFERED_SECONDS: usize = 1;

#[derive(Default)]
struct Shared {
    watchers: AtomicUsize,
    state: Mutex<TapState>,
}

#[derive(Default)]
struct TapState {
    rate: u32,
    mono: Vec<f32>,
}

#[derive(Clone, Default)]
pub struct RefTap {
    shared: Arc<Shared>,
}

impl RefTap {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&self, interleaved: &[f32], channels: u16, rate: u32) {
        if self.shared.watchers.load(Ordering::Relaxed) == 0 || channels == 0 {
            return;
        }
        let mut state = self.shared.state.lock().unwrap_or_else(|e| e.into_inner());
        if state.rate != rate {
            state.rate = rate;
            state.mono.clear();
        }
        if state.mono.len() > rate as usize * MAX_BUFFERED_SECONDS {
            state.mono.clear();
        }
        let channels = channels as usize;
        let scale = 1.0 / channels as f32;
        state.mono.extend(
            interleaved
                .chunks_exact(channels)
                .map(|f| f.iter().sum::<f32>() * scale),
        );
    }

    pub(crate) fn watch(&self) {
        self.shared.watchers.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn unwatch(&self) {
        self.shared.watchers.fetch_sub(1, Ordering::Relaxed);
    }

    pub(crate) fn take(&self, spare: &mut Vec<f32>) -> u32 {
        let mut state = self.shared.state.lock().unwrap_or_else(|e| e.into_inner());
        spare.clear();
        std::mem::swap(spare, &mut state.mono);
        state.rate
    }
}
