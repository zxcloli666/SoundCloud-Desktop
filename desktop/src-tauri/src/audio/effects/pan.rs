use std::f32::consts::{FRAC_PI_4, SQRT_2, TAU};

const NEAR_HZ: f32 = 20_000.0;
const FAR_HZ: f32 = 3_500.0;

pub struct HeadPan {
    gain: [f32; 2],
    coef: [f32; 2],
    low: [f32; 2],
}

impl HeadPan {
    pub fn new() -> Self {
        Self {
            gain: [1.0; 2],
            coef: [1.0; 2],
            low: [0.0; 2],
        }
    }

    pub fn aim(&mut self, position: f32, depth: f32, sample_rate: f32) {
        let angle = (position + 1.0) * FRAC_PI_4;
        let side = [
            (SQRT_2 * angle.cos()).min(1.0),
            (SQRT_2 * angle.sin()).min(1.0),
        ];
        let near = NEAR_HZ.min(sample_rate * 0.45);
        for ear in 0..2 {
            let shadow = depth * (1.0 - side[ear]);
            let cutoff = near * (FAR_HZ / near).powf(shadow);
            self.gain[ear] = 1.0 + depth * (side[ear] - 1.0);
            self.coef[ear] = 1.0 - (-TAU * cutoff / sample_rate).exp();
        }
    }

    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let input = [left, right];
        let mut out = [0.0; 2];
        for ear in 0..2 {
            self.low[ear] += self.coef[ear] * (input[ear] - self.low[ear]);
            out[ear] = self.low[ear] * self.gain[ear];
        }
        (out[0], out[1])
    }

    pub fn clear(&mut self) {
        self.low = [0.0; 2];
    }
}
