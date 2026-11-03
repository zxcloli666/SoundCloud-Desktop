mod reference;
mod render;
mod ring;
mod speech;
#[cfg(test)]
mod tests;

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use rodio::Source;
use rodio::mixer::Mixer;

pub use reference::Reference;
pub use render::Render;
use ring::Ring;
pub use speech::Speech;

const REFERENCE_CAPACITY: usize = 1 << 16;

pub struct Master {
    duck: AtomicU32,
    listening: AtomicBool,
    reference: OnceLock<Ring>,
    reference_rate: AtomicU32,
    speaking: AtomicUsize,
    voice: Mutex<Option<Mixer>>,
}

impl Master {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            duck: AtomicU32::new(1.0f32.to_bits()),
            listening: AtomicBool::new(false),
            reference: OnceLock::new(),
            reference_rate: AtomicU32::new(0),
            speaking: AtomicUsize::new(0),
            voice: Mutex::new(None),
        })
    }

    pub fn set_voice(&self, mixer: Mixer) {
        *self.voice.lock().unwrap() = Some(mixer);
    }

    fn duck_level(&self) -> f32 {
        f32::from_bits(self.duck.load(Ordering::Relaxed))
    }

    fn reference(&self) -> Option<&Ring> {
        if !self.listening.load(Ordering::Acquire) {
            return None;
        }
        self.reference.get()
    }

    fn is_speaking(&self) -> bool {
        self.speaking.load(Ordering::Relaxed) > 0
    }
}

#[allow(dead_code)]
impl Master {
    pub fn set_duck(&self, level: f32) {
        self.duck
            .store(level.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
    }

    pub fn attach_reference(self: &Arc<Self>) -> Option<Reference> {
        let ring = self.reference.get_or_init(|| Ring::new(REFERENCE_CAPACITY));
        self.listening
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .ok()?;
        ring.clear();
        Some(Reference::new(self.clone()))
    }

    pub fn speak<S>(self: &Arc<Self>, source: S) -> Speech
    where
        S: Source + Send + 'static,
    {
        let (speech, shot) = speech::start(source, self.clone());
        match self.voice.lock().unwrap().as_ref() {
            Some(voice) => voice.add(shot),
            None => drop(shot),
        }
        speech
    }
}
