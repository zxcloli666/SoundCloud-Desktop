use std::collections::VecDeque;

use rubato::{
    Resampler, SincFixedOut, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

const MAX_RATIO_OFFSET: f64 = 0.005;
const FILL_TAU_SECONDS: f32 = 1.0;
const KP: f32 = 0.5;
const KI: f32 = 0.05;

pub struct RefSync {
    ring: VecDeque<f32>,
    frame_len: usize,
    target: usize,
    primed: bool,
    steer: Option<Steer>,
    pub underruns: u32,
    pub overruns: u32,
}

struct Steer {
    resampler: SincFixedOut<f32>,
    input: Vec<Vec<f32>>,
    output: Vec<Vec<f32>>,
    filtered_fill: f32,
    target: f32,
    integral: f32,
    alpha: f32,
    frame_seconds: f32,
    sample_rate: f32,
    ppm: f32,
    first: bool,
}

impl RefSync {
    pub fn new(sample_rate: u32, target_ms: u32, steer: bool) -> Self {
        let frame_len = sample_rate as usize / 100;
        let target = (sample_rate * target_ms / 1000) as usize;
        let steer = steer.then(|| {
            let params = SincInterpolationParameters {
                sinc_len: 128,
                f_cutoff: 0.95,
                interpolation: SincInterpolationType::Cubic,
                oversampling_factor: 128,
                window: WindowFunction::BlackmanHarris2,
            };
            let resampler =
                SincFixedOut::<f32>::new(1.0, 1.0 + MAX_RATIO_OFFSET * 2.0, params, frame_len, 1)
                    .unwrap();
            let frame_seconds = 0.01;
            Steer {
                input: resampler.input_buffer_allocate(true),
                output: resampler.output_buffer_allocate(true),
                resampler,
                filtered_fill: target as f32,
                target: target as f32,
                integral: 0.0,
                alpha: 1.0 - (-frame_seconds / FILL_TAU_SECONDS).exp(),
                frame_seconds,
                sample_rate: sample_rate as f32,
                ppm: 0.0,
                first: false,
            }
        });
        Self {
            ring: VecDeque::new(),
            frame_len,
            target,
            primed: false,
            steer,
            underruns: 0,
            overruns: 0,
        }
    }

    pub fn push(&mut self, samples: &[f32]) {
        self.ring.extend(samples.iter().copied());
    }

    pub fn fill(&self) -> usize {
        self.ring.len()
    }

    pub fn ratio_ppm(&self) -> f32 {
        self.steer.as_ref().map_or(0.0, |s| s.ppm)
    }

    pub fn pull(&mut self, out: &mut [f32]) {
        if !self.primed {
            if self.ring.len() < self.target + self.frame_len {
                out.fill(0.0);
                return;
            }
            self.primed = true;
            let keep = self.target + self.frame_len;
            if self.ring.len() > keep {
                let stale = self.ring.len() - keep;
                self.ring.drain(..stale);
            }
            if let Some(steer) = self.steer.as_mut() {
                steer.target = (self.ring.len() - self.frame_len) as f32;
                steer.filtered_fill = steer.target;
                steer.first = true;
            }
        }
        match self.steer.as_mut() {
            Some(steer) => pull_steered(&mut self.ring, steer, &mut self.underruns, out),
            None => self.pull_plain(out),
        }
    }

    fn pull_plain(&mut self, out: &mut [f32]) {
        if self.ring.len() > self.target + self.target {
            let excess = self.ring.len() - self.target;
            self.ring.drain(..excess);
            self.overruns += 1;
        }
        if self.ring.len() < self.frame_len {
            out.fill(0.0);
            self.underruns += 1;
            return;
        }
        for (slot, sample) in out.iter_mut().zip(self.ring.drain(..self.frame_len)) {
            *slot = sample;
        }
    }
}

fn pull_steered(ring: &mut VecDeque<f32>, steer: &mut Steer, underruns: &mut u32, out: &mut [f32]) {
    let needed = steer.resampler.input_frames_next();
    let level_after = ring.len() as f32 - needed as f32;
    steer.filtered_fill += (level_after - steer.filtered_fill) * steer.alpha;
    let error = (steer.filtered_fill - steer.target) / steer.sample_rate;
    steer.integral += error * steer.frame_seconds;
    let limit = MAX_RATIO_OFFSET as f32;
    let offset = (KP * error + KI * steer.integral).clamp(-limit, limit);
    steer.ppm = offset * 1e6;
    let input_per_output = 1.0 + offset as f64;
    steer
        .resampler
        .set_resample_ratio_relative(1.0 / input_per_output, true)
        .unwrap();

    let needed = steer.resampler.input_frames_next();
    if ring.len() < needed {
        out.fill(0.0);
        *underruns += 1;
        return;
    }
    steer.input[0].clear();
    steer.input[0].extend(ring.drain(..needed));
    let (_, produced) = steer
        .resampler
        .process_into_buffer(&steer.input, &mut steer.output, None)
        .unwrap();
    out[..produced].copy_from_slice(&steer.output[0][..produced]);
    out[produced..].fill(0.0);
    if steer.first {
        steer.first = false;
        steer.target = ring.len() as f32;
        steer.filtered_fill = steer.target;
        steer.integral = 0.0;
    }
}
