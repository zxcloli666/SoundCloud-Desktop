use std::sync::{Arc, RwLock};
use std::time::Duration;

use biquad::{Biquad, DirectForm1};
use rodio::Source;
use rodio::source::SeekError;

use crate::audio::eq_curve::band_coefficients;
use crate::audio::types::{ChannelCount, EQ_BANDS, EqParams, SampleRate, frames_in};

const RAMP: Duration = Duration::from_millis(30);
const RAMP_STEP_FRAMES: usize = 32;
const SMOOTHING: Duration = Duration::from_millis(3);
const BYPASS_BELOW: f64 = 1e-4;

pub struct GainSource<S: Source<Item = f32>> {
    source: S,
    gain: f32,
}

impl<S: Source<Item = f32>> GainSource<S> {
    pub fn new(source: S, gain: f32) -> Self {
        Self { source, gain }
    }
}

impl<S: Source<Item = f32>> Iterator for GainSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        self.source.next().map(|sample| sample * self.gain)
    }
}

impl<S: Source<Item = f32>> Source for GainSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }

    fn channels(&self) -> ChannelCount {
        self.source.channels()
    }

    fn sample_rate(&self) -> SampleRate {
        self.source.sample_rate()
    }

    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }

    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.source.try_seek(pos)
    }
}

#[derive(Clone, Copy, PartialEq)]
struct Curve {
    gains: [f64; EQ_BANDS],
    preamp: f64,
}

impl Curve {
    fn toward(self, to: Curve, position: f64) -> Curve {
        Curve {
            gains: std::array::from_fn(|band| {
                self.gains[band] + (to.gains[band] - self.gains[band]) * position
            }),
            preamp: self.preamp + (to.preamp - self.preamp) * position,
        }
    }
}

fn db_to_gain(db: f64) -> f64 {
    10f64.powf(db / 20.0)
}

pub struct EqSource<S: Source<Item = f32>> {
    source: S,
    params: Arc<RwLock<EqParams>>,
    filters_l: [DirectForm1<f64>; EQ_BANDS],
    filters_r: [DirectForm1<f64>; EQ_BANDS],
    channels: ChannelCount,
    sample_rate: SampleRate,
    current_channel: u16,
    enabled: bool,
    wet: f64,
    from: Curve,
    current: Curve,
    target: Curve,
    ramp_frame: usize,
    ramp_frames: usize,
    preamp_gain: f64,
    preamp_target: f64,
    smoothing: f64,
}

impl<S: Source<Item = f32>> EqSource<S> {
    pub fn new(source: S, params: Arc<RwLock<EqParams>>) -> Self {
        let sample_rate = source.sample_rate();
        let channels = source.channels();
        let (enabled, curve) = match params.read() {
            Ok(params) => (
                params.enabled,
                Curve {
                    gains: params.gains,
                    preamp: params.preamp,
                },
            ),
            Err(_) => (
                false,
                Curve {
                    gains: [0.0; EQ_BANDS],
                    preamp: 0.0,
                },
            ),
        };
        let make_filters = || {
            std::array::from_fn(|band| {
                DirectForm1::<f64>::new(band_coefficients(
                    band,
                    curve.gains[band],
                    sample_rate.get() as f64,
                ))
            })
        };
        let preamp_gain = db_to_gain(curve.preamp);

        Self {
            source,
            params,
            filters_l: make_filters(),
            filters_r: make_filters(),
            channels,
            sample_rate,
            current_channel: 0,
            enabled,
            wet: if enabled { 1.0 } else { 0.0 },
            from: curve,
            current: curve,
            target: curve,
            ramp_frame: 0,
            ramp_frames: frames_in(RAMP, sample_rate).max(1),
            preamp_gain,
            preamp_target: preamp_gain,
            smoothing: 1.0 - (-1.0 / frames_in(SMOOTHING, sample_rate).max(1) as f64).exp(),
        }
    }

    fn follow_params(&mut self) {
        let Ok(params) = self.params.try_read() else {
            return;
        };
        let enabled = params.enabled;
        let target = Curve {
            gains: params.gains,
            preamp: params.preamp,
        };
        drop(params);

        self.enabled = enabled;
        if target != self.target {
            self.target = target;
            self.from = self.current;
            self.ramp_frame = 0;
        }
    }

    fn apply(&mut self, curve: Curve) {
        let sample_rate = self.sample_rate.get() as f64;
        for band in 0..EQ_BANDS {
            if curve.gains[band] == self.current.gains[band] {
                continue;
            }
            let coefficients = band_coefficients(band, curve.gains[band], sample_rate);
            self.filters_l[band].update_coefficients(coefficients);
            self.filters_r[band].update_coefficients(coefficients);
        }
        self.current = curve;
        self.preamp_target = db_to_gain(curve.preamp);
    }

    fn advance_frame(&mut self) {
        self.follow_params();

        let wet_target = if self.enabled { 1.0 } else { 0.0 };
        self.wet += (wet_target - self.wet) * self.smoothing;
        if !self.enabled && self.wet < BYPASS_BELOW {
            if self.wet > 0.0 {
                for filter in self.filters_l.iter_mut().chain(self.filters_r.iter_mut()) {
                    filter.reset_state();
                }
            }
            self.wet = 0.0;
        }

        if self.current != self.target {
            self.ramp_frame += 1;
            if self.wet == 0.0 || self.ramp_frame >= self.ramp_frames {
                self.apply(self.target);
            } else if self.ramp_frame % RAMP_STEP_FRAMES == 0 {
                let position = self.ramp_frame as f64 / self.ramp_frames as f64;
                self.apply(self.from.toward(self.target, position));
            }
        }

        if self.wet == 0.0 {
            self.preamp_gain = self.preamp_target;
        } else {
            self.preamp_gain += (self.preamp_target - self.preamp_gain) * self.smoothing;
        }
    }
}

impl<S: Source<Item = f32>> Iterator for EqSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.source.next()?;
        let ch = self.current_channel;
        self.current_channel = (ch + 1) % self.channels.get();
        if ch == 0 {
            self.advance_frame();
        }

        if self.wet == 0.0 {
            return Some(sample);
        }

        let dry = sample as f64;
        let filters = if ch == 0 {
            &mut self.filters_l
        } else {
            &mut self.filters_r
        };
        let mut out = dry * self.preamp_gain;
        for filter in filters.iter_mut() {
            out = Biquad::run(filter, out);
        }

        Some((dry + (out - dry) * self.wet) as f32)
    }
}

impl<S: Source<Item = f32>> Source for EqSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
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
        for filter in self.filters_l.iter_mut().chain(self.filters_r.iter_mut()) {
            filter.reset_state();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::num::NonZero;

    use rodio::buffer::SamplesBuffer;

    use super::*;

    const RATE: u32 = 48_000;
    const KHZ_QUARTER_PERIOD_SAMPLES: usize = 24;
    const BASS_DESTROYER: [f64; EQ_BANDS] =
        [12.0, 12.0, 10.0, 7.0, 3.0, 0.0, -2.0, -4.0, -4.0, -5.0];

    fn sine(frequency: f32, seconds: f32) -> SamplesBuffer {
        let samples = (0..(RATE as f32 * seconds) as usize)
            .flat_map(|i| {
                let value =
                    (i as f32 / RATE as f32 * frequency * std::f32::consts::TAU).sin() * 0.5;
                [value, value]
            })
            .collect::<Vec<_>>();
        SamplesBuffer::new(
            NonZero::new(2).unwrap(),
            NonZero::new(RATE).unwrap(),
            samples,
        )
    }

    fn params(gains: [f64; EQ_BANDS], preamp: f64) -> Arc<RwLock<EqParams>> {
        Arc::new(RwLock::new(EqParams {
            enabled: true,
            gains,
            preamp,
        }))
    }

    fn set(params: &RwLock<EqParams>, gains: [f64; EQ_BANDS], preamp: f64) {
        let mut params = params.write().unwrap();
        params.gains = gains;
        params.preamp = preamp;
    }

    fn left(samples: &[f32]) -> Vec<f32> {
        samples.iter().step_by(2).copied().collect()
    }

    fn peak(samples: &[f32]) -> f32 {
        samples
            .iter()
            .fold(0.0, |peak, sample| peak.max(sample.abs()))
    }

    fn largest_step(samples: &[f32]) -> f32 {
        left(samples)
            .windows(2)
            .map(|pair| (pair[1] - pair[0]).abs())
            .fold(0.0, f32::max)
    }

    #[test]
    fn starts_with_the_curve_already_applied() {
        let source = EqSource::new(sine(1000.0, 0.1), params([0.0; EQ_BANDS], -12.0));
        let head = source.take(RATE as usize / 100).collect::<Vec<_>>();
        assert!((peak(&head) - 0.5 * 0.251).abs() < 0.005, "{}", peak(&head));
    }

    #[test]
    fn preamp_change_glides() {
        let params = params([0.0; EQ_BANDS], 0.0);
        let mut source = EqSource::new(sine(1000.0, 1.0), params.clone());
        let mut output = source
            .by_ref()
            .take(RATE as usize / 2 + KHZ_QUARTER_PERIOD_SAMPLES)
            .collect::<Vec<_>>();
        set(&params, [0.0; EQ_BANDS], -12.0);
        output.extend(source);

        assert!(largest_step(&output) < 0.07, "{}", largest_step(&output));
        let tail = &output[output.len() - RATE as usize / 5..];
        assert!((peak(tail) - 0.5 * 0.251).abs() < 0.005, "{}", peak(tail));
    }

    #[test]
    fn bass_preset_switch_stays_below_full_scale() {
        let preamp = crate::audio::eq_curve::auto_preamp(&BASS_DESTROYER);
        let params = params([0.0; EQ_BANDS], 0.0);
        let mut source = EqSource::new(sine(60.0, 2.0), params.clone());
        let before = source.by_ref().take(RATE as usize).collect::<Vec<_>>();
        set(&params, BASS_DESTROYER, preamp);
        let switched = source.by_ref().take(RATE as usize / 2).collect::<Vec<_>>();
        set(&params, [0.0; EQ_BANDS], 0.0);
        let back = source.collect::<Vec<_>>();

        let ceiling = peak(&switched[switched.len() / 2..]).max(peak(&before)) * 1.05;
        assert!(peak(&switched) <= ceiling, "{}", peak(&switched));
        assert!(peak(&back) <= ceiling, "{}", peak(&back));
        assert!(
            largest_step(&switched) < 0.01,
            "{}",
            largest_step(&switched)
        );
        assert!(largest_step(&back) < 0.01, "{}", largest_step(&back));
    }

    #[test]
    fn toggling_fades_between_dry_and_eq() {
        let params = params([0.0; EQ_BANDS], -12.0);
        let mut source = EqSource::new(sine(1000.0, 1.0), params.clone());
        let mut output = source
            .by_ref()
            .take(RATE as usize / 4 + KHZ_QUARTER_PERIOD_SAMPLES)
            .collect::<Vec<_>>();
        params.write().unwrap().enabled = false;
        output.extend(source.by_ref().take(RATE as usize / 4));
        params.write().unwrap().enabled = true;
        output.extend(source);

        assert!(largest_step(&output) < 0.07, "{}", largest_step(&output));
        let middle = &output[RATE as usize / 2 - RATE as usize / 10..RATE as usize / 2];
        assert!((peak(middle) - 0.5).abs() < 0.005, "{}", peak(middle));
    }
}
