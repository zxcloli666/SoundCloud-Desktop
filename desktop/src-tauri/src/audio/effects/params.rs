use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

pub const MAX_BASS_DB: f32 = 12.0;
pub const MIN_PAN_HZ: f32 = 0.05;
pub const MAX_PAN_HZ: f32 = 0.5;
const PAN_REVERB: f32 = 0.12;

#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub reverb: f32,
    pub room: f32,
    pub eight_d: bool,
    pub eight_d_hz: f32,
    pub bass_db: f32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            reverb: 0.0,
            room: 0.5,
            eight_d: false,
            eight_d_hz: 0.15,
            bass_db: 0.0,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Targets {
    pub reverb: f32,
    pub room: f32,
    pub pan: f32,
    pub pan_hz: f32,
    pub bass_db: f32,
}

#[derive(Default)]
pub struct EffectsParams {
    premium: AtomicBool,
    reverb: AtomicU32,
    room: AtomicU32,
    eight_d: AtomicBool,
    eight_d_hz: AtomicU32,
    bass_db: AtomicU32,
}

fn store(slot: &AtomicU32, value: f32, min: f32, max: f32) {
    let value = if value.is_finite() { value } else { 0.0 };
    slot.store(value.clamp(min, max).to_bits(), Ordering::Relaxed);
}

fn load(slot: &AtomicU32) -> f32 {
    f32::from_bits(slot.load(Ordering::Relaxed))
}

impl EffectsParams {
    pub fn new() -> Self {
        let params = Self::default();
        params.set(Settings::default());
        params
    }

    pub fn set_premium(&self, premium: bool) {
        self.premium.store(premium, Ordering::Relaxed);
    }

    pub fn set(&self, settings: Settings) {
        store(&self.reverb, settings.reverb, 0.0, 1.0);
        store(&self.room, settings.room, 0.0, 1.0);
        self.eight_d.store(settings.eight_d, Ordering::Relaxed);
        store(
            &self.eight_d_hz,
            settings.eight_d_hz,
            MIN_PAN_HZ,
            MAX_PAN_HZ,
        );
        store(&self.bass_db, settings.bass_db, 0.0, MAX_BASS_DB);
    }

    pub fn targets(&self) -> Targets {
        let open = self.premium.load(Ordering::Relaxed);
        let gate = |value: f32| if open { value } else { 0.0 };
        let pan = self.eight_d.load(Ordering::Relaxed) as u8 as f32;
        Targets {
            reverb: gate((load(&self.reverb) + PAN_REVERB * pan).min(1.0)),
            room: load(&self.room),
            pan: gate(pan),
            pan_hz: load(&self.eight_d_hz),
            bass_db: gate(load(&self.bass_db)),
        }
    }
}
