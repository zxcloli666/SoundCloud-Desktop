const THRESHOLD: f32 = 0.9;
const CEILING: f32 = 0.99;
const ATTACK_SECS: f32 = 0.0005;
const RELEASE_SECS: f32 = 0.08;

pub struct Limiter {
    gain: f32,
    attack: f32,
    release: f32,
}

fn coefficient(secs: f32, sample_rate: f32) -> f32 {
    1.0 - (-1.0 / (secs * sample_rate)).exp()
}

impl Limiter {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            gain: 1.0,
            attack: coefficient(ATTACK_SECS, sample_rate),
            release: coefficient(RELEASE_SECS, sample_rate),
        }
    }

    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let peak = left.abs().max(right.abs());
        if peak <= THRESHOLD && self.gain == 1.0 {
            return (left, right);
        }
        let target = if peak > THRESHOLD {
            THRESHOLD / peak
        } else {
            1.0
        };
        let rate = if target < self.gain {
            self.attack
        } else {
            self.release
        };
        self.gain += (target - self.gain) * rate;
        if 1.0 - self.gain < 1e-6 {
            self.gain = 1.0;
        }
        let guard = if peak > CEILING { CEILING / peak } else { 1.0 };
        let gain = self.gain.min(guard);
        (
            (left * gain).clamp(-1.0, 1.0),
            (right * gain).clamp(-1.0, 1.0),
        )
    }

    pub fn clear(&mut self) {
        self.gain = 1.0;
    }
}
