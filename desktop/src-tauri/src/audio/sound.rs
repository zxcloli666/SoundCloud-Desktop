use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, RwLock};

use crate::audio::effects::EffectsParams;
use crate::audio::types::EqParams;

#[derive(Clone)]
pub struct Sound {
    pub eq: Arc<RwLock<EqParams>>,
    pub pitch: Arc<AtomicU32>,
    pub effects: Arc<EffectsParams>,
}

impl Sound {
    pub fn new() -> Self {
        Self {
            eq: Arc::new(RwLock::new(EqParams::default())),
            pitch: Arc::new(AtomicU32::new(1.0f32.to_bits())),
            effects: Arc::new(EffectsParams::new()),
        }
    }

    pub fn copy_from(&self, other: &Sound) {
        let source = other.eq.read().unwrap();
        let mut eq = self.eq.write().unwrap();
        eq.enabled = source.enabled;
        eq.gains = source.gains;
        eq.preamp = source.preamp;
        self.pitch
            .store(other.pitch.load(Ordering::Relaxed), Ordering::Relaxed);
        self.effects.copy_from(&other.effects);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_copy_keeps_the_values_but_not_the_cells() {
        let old = Sound::new();
        old.pitch.store(1.5f32.to_bits(), Ordering::Relaxed);
        old.eq.write().unwrap().preamp = -3.0;
        old.effects.set_premium(true);

        let new = Sound::new();
        new.copy_from(&old);
        assert_eq!(new.pitch.load(Ordering::Relaxed), 1.5f32.to_bits());
        assert_eq!(new.eq.read().unwrap().preamp, -3.0);

        new.pitch.store(0.5f32.to_bits(), Ordering::Relaxed);
        new.eq.write().unwrap().preamp = 4.0;
        assert_eq!(old.pitch.load(Ordering::Relaxed), 1.5f32.to_bits());
        assert_eq!(old.eq.read().unwrap().preamp, -3.0);
    }
}
