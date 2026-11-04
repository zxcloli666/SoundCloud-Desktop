use crate::frames::{FRAME, Frame, energy};

pub const REFERENCE_FLOOR_RMS: f32 = 0.0005;
pub const REFERENCE_HOLD_FRAMES: u32 = 50;

pub struct EchoGate {
    quiet_frames: u32,
    weight: f32,
}

impl Default for EchoGate {
    fn default() -> Self {
        Self::new()
    }
}

impl EchoGate {
    pub fn new() -> Self {
        Self {
            quiet_frames: REFERENCE_HOLD_FRAMES,
            weight: 0.0,
        }
    }

    pub fn mix(&mut self, reference: &Frame, raw: &Frame, cleaned: &Frame) -> Frame {
        if energy(reference).sqrt() >= REFERENCE_FLOOR_RMS {
            self.quiet_frames = 0;
        } else {
            self.quiet_frames = (self.quiet_frames + 1).min(REFERENCE_HOLD_FRAMES);
        }
        let target = if self.quiet_frames < REFERENCE_HOLD_FRAMES {
            1.0
        } else {
            0.0
        };
        if self.weight == 0.0 && target == 0.0 {
            return *raw;
        }
        if self.weight == 1.0 && target == 1.0 {
            return *cleaned;
        }
        let step = (target - self.weight) / FRAME as f32;
        let mut out = [0.0; FRAME];
        for i in 0..FRAME {
            let w = self.weight + step * (i + 1) as f32;
            out[i] = raw[i] + (cleaned[i] - raw[i]) * w;
        }
        self.weight = target;
        out
    }
}
