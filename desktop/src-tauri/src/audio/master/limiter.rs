const CEILING: f32 = 1.0;
const LOOKAHEAD_SECS: f32 = 0.0015;
const HOLD_SECS: f32 = 0.015;
const RELEASE_SECS: f32 = 0.15;
const SNAP: f32 = 1e-3;

pub struct Limiter {
    channels: usize,
    window: usize,
    frames: Vec<f32>,
    needed: Vec<f32>,
    smoothed: Vec<f32>,
    out: Vec<f32>,
    slot: usize,
    quiet: usize,
    settled: usize,
    gain: f32,
    hold: usize,
    hold_frames: usize,
    release: f32,
    primed: bool,
}

impl Limiter {
    pub fn new(channels: usize, rate: u32) -> Self {
        let rate = rate as f32;
        let window = (LOOKAHEAD_SECS * rate) as usize + 1;
        Self {
            channels,
            window,
            frames: vec![0.0; window * channels],
            needed: vec![1.0; window],
            smoothed: vec![1.0; window],
            out: vec![0.0; channels],
            slot: 0,
            quiet: window,
            settled: window,
            gain: 1.0,
            hold: 0,
            hold_frames: (HOLD_SECS * rate) as usize,
            release: 1.0 - (-1.0 / (RELEASE_SECS * rate)).exp(),
            primed: false,
        }
    }

    pub fn advance(&mut self, source: &mut impl Iterator<Item = f32>) {
        if !self.primed {
            self.primed = true;
            for _ in 1..self.window {
                self.step(source);
            }
        }
        self.step(source);
    }

    pub fn sample(&self, channel: usize) -> f32 {
        self.out[channel]
    }

    fn step(&mut self, source: &mut impl Iterator<Item = f32>) {
        let start = self.slot * self.channels;
        let mut peak = 0.0f32;
        for sample in &mut self.frames[start..start + self.channels] {
            *sample = source.next().unwrap_or(0.0);
            peak = peak.max(sample.abs());
        }
        let needed = if peak > CEILING { CEILING / peak } else { 1.0 };
        self.needed[self.slot] = needed;
        self.quiet = if needed < 1.0 {
            0
        } else {
            self.quiet.saturating_add(1)
        };

        let held = if self.quiet >= self.window {
            1.0
        } else {
            self.needed.iter().copied().fold(1.0, f32::min)
        };
        self.follow(held);
        self.smoothed[self.slot] = self.gain;
        self.settled = if self.gain < 1.0 {
            0
        } else {
            self.settled.saturating_add(1)
        };

        let gain = if self.settled >= self.window {
            1.0
        } else {
            let sum: f64 = self.smoothed.iter().map(|&gain| gain as f64).sum();
            (sum / self.window as f64) as f32
        };

        self.slot = (self.slot + 1) % self.window;
        let oldest = self.slot * self.channels;
        for (out, sample) in self.out.iter_mut().zip(&self.frames[oldest..]) {
            *out = sample * gain;
        }
    }

    fn follow(&mut self, held: f32) {
        if held < self.gain {
            self.gain = held;
            self.hold = self.hold_frames;
        } else if self.hold > 0 {
            self.hold -= 1;
        } else {
            self.gain += (held - self.gain) * self.release;
            if held - self.gain < SNAP {
                self.gain = held;
            }
        }
    }
}
