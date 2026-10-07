use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

use biquad::{Biquad, Coefficients, DirectForm1, ToHertz, Type, Q_BUTTERWORTH_F32};
use rodio::source::SeekError;
use rodio::Source;

use crate::audio::types::{frames_in, ChannelCount, SampleRate};

const HOP: Duration = Duration::from_millis(25);
const TOLERANCE: Duration = Duration::from_millis(12);
const COARSE_STEP: usize = 4;
const LOWPASS_PRIME_SAMPLES: usize = 256;

fn hop_frames(sample_rate: SampleRate) -> usize {
    frames_in(HOP, sample_rate).max(64)
}

fn is_unity(ratio: f32) -> bool {
    (ratio - 1.0).abs() < 1e-3
}

fn passthrough() -> Coefficients<f32> {
    Coefficients {
        a1: 0.0,
        a2: 0.0,
        b0: 1.0,
        b1: 0.0,
        b2: 0.0,
    }
}

pub struct PitchSource<S: Source<Item = f32>> {
    source: S,
    ratio: Arc<AtomicU32>,
    channels: ChannelCount,
    sample_rate: SampleRate,
    span_len: usize,
    channel: usize,
    shifter: Option<Shifter>,
}

impl<S: Source<Item = f32>> PitchSource<S> {
    pub fn new(source: S, ratio: Arc<AtomicU32>) -> Self {
        let channels = source.channels();
        let sample_rate = source.sample_rate();
        Self {
            source,
            ratio,
            channels,
            sample_rate,
            span_len: hop_frames(sample_rate) * channels.get() as usize,
            channel: 0,
            shifter: None,
        }
    }

    fn ratio(&self) -> f32 {
        f32::from_bits(self.ratio.load(Ordering::Relaxed))
    }

    fn switch_mode(&mut self, ratio: f32) {
        let unity = is_unity(ratio);
        if let Some(shifter) = self.shifter.as_mut()
            && shifter.hop_done()
        {
            if unity && !shifter.finishing {
                shifter.finish(&mut self.source);
            }
            if shifter.finishing && shifter.hop_done() {
                self.shifter = None;
            }
        }
        if self.shifter.is_none() && !unity {
            self.shifter = Some(Shifter::new(self.channels, self.sample_rate));
        }
    }
}

impl<S: Source<Item = f32>> Iterator for PitchSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let ratio = self.ratio();
        if self.channel == 0 {
            self.switch_mode(ratio);
        }
        let sample = match self.shifter.as_mut() {
            Some(shifter) => shifter.next(&mut self.source, ratio)?,
            None => self.source.next()?,
        };
        self.channel = (self.channel + 1) % self.channels.get() as usize;
        Some(sample)
    }
}

impl<S: Source<Item = f32>> Source for PitchSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        Some(self.span_len)
    }

    fn channels(&self) -> ChannelCount {
        self.channels
    }

    fn sample_rate(&self) -> SampleRate {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.source.try_seek(pos)?;
        if self.shifter.take().is_some() {
            for _ in 0..self.channel {
                self.source.next();
            }
        }
        Ok(())
    }
}

struct Shifter {
    channels: usize,
    sample_rate: f32,
    hop: usize,
    tolerance: usize,
    rise: Vec<f32>,
    lowpass: Vec<[DirectForm1<f32>; 2]>,
    lowpass_ratio: f32,
    previous: Vec<f32>,
    upcoming: Vec<f32>,
    previous_frame: usize,
    phase: f32,
    started: bool,
    pitched: Vec<f32>,
    positions: Vec<f64>,
    base: usize,
    continuation: usize,
    target: f64,
    reference: Vec<f32>,
    mono: Vec<f32>,
    out: Vec<f32>,
    out_pos: usize,
    raw: Vec<f32>,
    raw_base: usize,
    read_frames: usize,
    played_frames: usize,
    source_done: bool,
    finishing: bool,
}

impl Shifter {
    fn new(channels: ChannelCount, sample_rate: SampleRate) -> Self {
        let channels = channels.get() as usize;
        let hop = hop_frames(sample_rate);
        let rise = (0..hop)
            .map(|j| {
                let x = (j as f32 + 0.5) / hop as f32 * std::f32::consts::FRAC_PI_2;
                x.sin().powi(2)
            })
            .collect();
        Self {
            channels,
            sample_rate: sample_rate.get() as f32,
            hop,
            tolerance: frames_in(TOLERANCE, sample_rate).max(16),
            rise,
            lowpass: vec![[DirectForm1::new(passthrough()); 2]; channels],
            lowpass_ratio: 1.0,
            previous: vec![0.0; channels],
            upcoming: vec![0.0; channels],
            previous_frame: 0,
            phase: 0.0,
            started: false,
            pitched: Vec::new(),
            positions: Vec::new(),
            base: 0,
            continuation: 0,
            target: 0.0,
            reference: Vec::new(),
            mono: Vec::new(),
            out: Vec::new(),
            out_pos: 0,
            raw: Vec::new(),
            raw_base: 0,
            read_frames: 0,
            played_frames: 0,
            source_done: false,
            finishing: false,
        }
    }

    fn hop_done(&self) -> bool {
        self.out_pos == self.out.len()
    }

    fn next<S: Source<Item = f32>>(&mut self, source: &mut S, ratio: f32) -> Option<f32> {
        if self.out_pos == self.out.len() {
            self.render_hop(source, ratio);
            if self.out.is_empty() {
                return None;
            }
        }
        let sample = self.out[self.out_pos];
        self.out_pos += 1;
        Some(sample)
    }

    fn update_lowpass(&mut self, ratio: f32) {
        if ratio == self.lowpass_ratio {
            return;
        }
        self.lowpass_ratio = ratio;
        let coefficients = if ratio > 1.0 {
            let cutoff = 0.45 * self.sample_rate / ratio;
            Coefficients::<f32>::from_params(
                Type::LowPass,
                self.sample_rate.hz(),
                cutoff.hz(),
                Q_BUTTERWORTH_F32,
            )
            .unwrap_or_else(|_| passthrough())
        } else {
            passthrough()
        };
        for filter in self.lowpass.iter_mut().flatten() {
            filter.update_coefficients(coefficients);
        }
    }

    fn read_frame<S: Source<Item = f32>>(&mut self, source: &mut S) {
        let frame_start = self.raw.len();
        for channel in 0..self.channels {
            let sample = if self.source_done { None } else { source.next() };
            let sample = sample.unwrap_or_else(|| {
                self.source_done = true;
                0.0
            });
            self.raw.push(sample);
            let [first, second] = &mut self.lowpass[channel];
            if self.read_frames == 0 && !self.started {
                for _ in 0..LOWPASS_PRIME_SAMPLES {
                    second.run(first.run(sample));
                }
            }
            self.upcoming[channel] = second.run(first.run(sample));
        }
        if self.source_done {
            self.raw.truncate(frame_start);
        } else {
            self.read_frames += 1;
        }
    }

    fn push_pitched<S: Source<Item = f32>>(&mut self, source: &mut S, ratio: f32) {
        if !self.started {
            self.read_frame(source);
            std::mem::swap(&mut self.previous, &mut self.upcoming);
            self.read_frame(source);
            self.started = true;
        }
        for channel in 0..self.channels {
            let from = self.previous[channel];
            let to = self.upcoming[channel];
            self.pitched.push(from + (to - from) * self.phase);
        }
        self.positions.push(self.previous_frame as f64 + self.phase as f64);
        self.phase += ratio;
        while self.phase >= 1.0 {
            self.phase -= 1.0;
            std::mem::swap(&mut self.previous, &mut self.upcoming);
            self.previous_frame += 1;
            self.read_frame(source);
        }
    }

    fn render_hop<S: Source<Item = f32>>(&mut self, source: &mut S, ratio: f32) {
        self.update_lowpass(ratio);
        self.out.clear();
        self.out_pos = 0;

        let channels = self.channels;
        let hop = self.hop;
        let target = self.target.round() as usize;
        let low = target.saturating_sub(self.tolerance).max(self.base);
        let high = target + self.tolerance;
        let end = (high + hop).max(self.continuation + hop);
        while self.base + self.pitched.len() / channels < end {
            self.push_pitched(source, ratio);
        }

        let best = self.best_match(low, high);
        let from = (self.continuation - self.base) * channels;
        let to = (best - self.base) * channels;
        for (j, rise) in self.rise.iter().enumerate() {
            for channel in 0..channels {
                let a = self.pitched[from + j * channels + channel];
                let b = self.pitched[to + j * channels + channel];
                self.out.push(a + (b - a) * rise);
            }
        }

        if self.source_done {
            let left = self.read_frames.saturating_sub(self.played_frames).min(hop);
            self.out.truncate(left * channels);
        }
        self.played_frames += hop;

        self.continuation = best + hop;
        self.target += hop as f64 / ratio as f64;
        let keep = (self.target as usize)
            .saturating_sub(self.tolerance)
            .min(self.continuation);
        if keep > self.base {
            self.pitched.drain(..(keep - self.base) * channels);
            self.positions.drain(..keep - self.base);
            self.base = keep;
            self.drop_played_raw();
        }
    }

    fn drop_played_raw(&mut self) {
        let Some(&position) = self.positions.first() else {
            return;
        };
        let keep = position as usize;
        if keep > self.raw_base {
            let samples = ((keep - self.raw_base) * self.channels).min(self.raw.len());
            self.raw.drain(..samples);
            self.raw_base = keep;
        }
    }

    fn finish<S: Source<Item = f32>>(&mut self, source: &mut S) {
        let channels = self.channels;
        while self.base + self.pitched.len() / channels < self.continuation + self.hop {
            self.push_pitched(source, 1.0);
        }
        let start = self.positions[self.continuation - self.base].round() as usize;
        let pitched_from = (self.continuation - self.base) * channels;
        let raw_from = start.saturating_sub(self.raw_base) * channels;

        self.out.clear();
        self.out_pos = 0;
        for (j, rise) in self.rise.iter().enumerate() {
            let at = raw_from + j * channels;
            let Some(frame) = self.raw.get(at..at + channels) else {
                break;
            };
            for (channel, &to) in frame.iter().enumerate() {
                let from = self.pitched[pitched_from + j * channels + channel];
                self.out.push(from + (to - from) * rise);
            }
        }
        let rest = (raw_from + self.out.len()).min(self.raw.len());
        self.out.extend_from_slice(&self.raw[rest..]);
        self.finishing = true;
    }

    fn best_match(&mut self, low: usize, high: usize) -> usize {
        let channels = self.channels;
        let mono_at = |pitched: &[f32], frame: usize| -> f32 {
            pitched[frame * channels..(frame + 1) * channels].iter().sum()
        };

        let continuation = self.continuation - self.base;
        self.reference.clear();
        for j in (0..self.hop).step_by(2) {
            self.reference.push(mono_at(&self.pitched, continuation + j));
        }
        self.mono.clear();
        for frame in low - self.base..high + self.hop - self.base {
            self.mono.push(mono_at(&self.pitched, frame));
        }

        let score = |offset: usize| -> f32 {
            let mut correlation = 0.0;
            let mut energy = 1e-9;
            for (i, reference) in self.reference.iter().enumerate() {
                let sample = self.mono[offset + i * 2];
                correlation += reference * sample;
                energy += sample * sample;
            }
            correlation / energy.sqrt()
        };

        let span = high - low;
        let mut best = 0;
        let mut best_score = f32::MIN;
        for offset in (0..=span).step_by(COARSE_STEP) {
            let value = score(offset);
            if value > best_score {
                best = offset;
                best_score = value;
            }
        }
        let around = best.saturating_sub(COARSE_STEP - 1)..=(best + COARSE_STEP - 1).min(span);
        for offset in around {
            let value = score(offset);
            if value > best_score {
                best = offset;
                best_score = value;
            }
        }
        low + best
    }
}

#[cfg(test)]
mod tests {
    use std::num::NonZero;

    use rodio::buffer::SamplesBuffer;
    use rodio::Player;

    use super::*;

    const RATE: u32 = 48_000;

    fn sine(frequency: f32, seconds: f32) -> SamplesBuffer {
        let frames = (RATE as f32 * seconds) as usize;
        let samples = (0..frames)
            .flat_map(|i| {
                let value = (i as f32 / RATE as f32 * frequency * std::f32::consts::TAU).sin() * 0.5;
                [value, value]
            })
            .collect::<Vec<_>>();
        SamplesBuffer::new(NonZero::new(2).unwrap(), NonZero::new(RATE).unwrap(), samples)
    }

    fn shifted(ratio: f32) -> Vec<f32> {
        let ratio = Arc::new(AtomicU32::new(ratio.to_bits()));
        PitchSource::new(sine(440.0, 2.0), ratio).collect()
    }

    fn frequency(samples: &[f32]) -> f32 {
        let left = samples.iter().step_by(2).copied().collect::<Vec<_>>();
        let middle = &left[left.len() / 4..left.len() * 3 / 4];
        let crossings = middle
            .windows(2)
            .filter(|pair| pair[0] < 0.0 && pair[1] >= 0.0)
            .count();
        crossings as f32 / (middle.len() as f32 / RATE as f32)
    }

    fn largest_step(samples: &[f32]) -> f32 {
        let left = samples.iter().step_by(2).copied().collect::<Vec<_>>();
        left.windows(2)
            .map(|pair| (pair[1] - pair[0]).abs())
            .fold(0.0, f32::max)
    }

    fn close_to(measured: f32, expected: f32) -> bool {
        (measured / expected - 1.0).abs() < 0.03
    }

    #[test]
    fn unity_ratio_passes_samples_through() {
        let expected = sine(440.0, 2.0).collect::<Vec<_>>();
        assert_eq!(shifted(1.0), expected);
    }

    #[test]
    fn shifts_pitch_and_keeps_length() {
        for ratio in [0.25f32, 0.5, 0.8, 1.5, 2.0, 4.0] {
            let output = shifted(ratio);
            let frames = output.len() / 2;
            assert!(frames.abs_diff(2 * RATE as usize) <= RATE as usize / 40, "{ratio}: {frames}");
            let measured = frequency(&output);
            assert!((measured / (440.0 * ratio) - 1.0).abs() < 0.03, "{ratio}: {measured}");
        }
    }

    #[test]
    fn seek_keeps_channel_order() {
        let ratio = Arc::new(AtomicU32::new(1.5f32.to_bits()));
        let samples = (0..RATE as usize * 2)
            .flat_map(|_| [0.5f32, -0.5])
            .collect::<Vec<_>>();
        let buffer = SamplesBuffer::new(NonZero::new(2).unwrap(), NonZero::new(RATE).unwrap(), samples);
        let mut source = PitchSource::new(buffer, ratio);
        source.by_ref().take(RATE as usize + 1).for_each(drop);
        source.try_seek(Duration::from_millis(200)).unwrap();
        let after = source.take(RATE as usize).collect::<Vec<_>>();
        assert!(after[0] < 0.0);
        assert!((after[1] - 0.5).abs() < 0.01);
        assert!(after[RATE as usize / 2] < 0.0);
        assert!(after[RATE as usize / 2 + 1] > 0.0);
    }

    #[test]
    fn speed_changes_reach_the_mixer_while_shifting() {
        let (mixer, mut output) =
            rodio::mixer::mixer(NonZero::new(2).unwrap(), NonZero::new(RATE).unwrap());
        let player = Player::connect_new(&mixer);
        let ratio = Arc::new(AtomicU32::new(1.5f32.to_bits()));
        player.append(PitchSource::new(sine(440.0, 20.0), ratio.clone()));

        let before = output.by_ref().take(RATE as usize * 2).collect::<Vec<_>>();
        let position_before = player.get_pos().as_secs_f32();
        player.set_speed(2.0);
        output.by_ref().take(RATE as usize / 5).for_each(drop);
        let after = output.by_ref().take(RATE as usize * 2).collect::<Vec<_>>();
        let position_after = player.get_pos().as_secs_f32();
        assert!(close_to(frequency(&before), 660.0), "{}", frequency(&before));
        assert!(close_to(frequency(&after), 1320.0), "{}", frequency(&after));
        assert!((position_after - position_before - 1.1).abs() < 0.03);

        ratio.store(1.0f32.to_bits(), Ordering::Relaxed);
        output.by_ref().take(RATE as usize / 2).for_each(drop);
        let back = output.by_ref().take(RATE as usize * 2).collect::<Vec<_>>();
        assert!(close_to(frequency(&back), 880.0), "{}", frequency(&back));
    }

    #[test]
    fn returns_to_pass_through_without_skipping() {
        let input = sine(440.0, 2.0).collect::<Vec<_>>();
        let ratio = Arc::new(AtomicU32::new(1.5f32.to_bits()));
        let mut source = PitchSource::new(sine(440.0, 2.0), ratio.clone());
        let mut output = source.by_ref().take(RATE as usize).collect::<Vec<_>>();
        ratio.store(1.0f32.to_bits(), Ordering::Relaxed);
        output.extend(source.by_ref().take(RATE as usize / 2));
        assert!(source.shifter.is_none());
        output.extend(source);

        let tail = RATE as usize;
        assert_eq!(output[output.len() - tail..], input[input.len() - tail..]);
        let frames = output.len() / 2;
        assert!(frames.abs_diff(input.len() / 2) <= RATE as usize / 40, "{frames}");
        assert!(largest_step(&output) < 0.1, "{}", largest_step(&output));
    }
}
