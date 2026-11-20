use std::collections::VecDeque;
use std::f64::consts::PI;
use std::sync::mpsc::{Receiver, Sender, TryRecvError, channel};

use crate::clip::Clip;

const HALF: usize = 32;
const TAPS: usize = HALF * 2;
const PHASES: usize = 256;
const KAISER: f64 = 9.0;

pub struct Feed(Sender<Vec<f32>>);

impl Feed {
    pub fn push(&self, samples: Vec<f32>) {
        let _ = self.0.send(samples);
    }
}

pub struct Stream {
    rate: u32,
    chunks: Receiver<Vec<f32>>,
    chunk: Vec<f32>,
    at: usize,
    open: bool,
}

impl Stream {
    pub fn open(rate: u32) -> (Feed, Stream) {
        let (tx, chunks) = channel();
        let stream = Stream {
            rate,
            chunks,
            chunk: Vec::new(),
            at: 0,
            open: true,
        };
        (Feed(tx), stream)
    }

    pub fn rate(&self) -> u32 {
        self.rate
    }

    pub fn at_rate(self, rate: u32) -> Resampled {
        let rate = rate.max(1);
        let step = self.rate as f64 / rate as f64;
        Resampled {
            kernel: if rate == self.rate {
                Vec::new()
            } else {
                kernel(step)
            },
            stream: self,
            step,
            frac: 0.0,
            near: VecDeque::with_capacity(TAPS),
            ahead: 0,
            open: true,
        }
    }
}

impl From<Clip> for Stream {
    fn from(clip: Clip) -> Stream {
        let (feed, stream) = Stream::open(clip.rate);
        feed.push(clip.samples);
        stream
    }
}

impl Iterator for Stream {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        loop {
            if let Some(sample) = self.chunk.get(self.at) {
                self.at += 1;
                return Some(*sample);
            }
            if !self.open {
                return None;
            }
            match self.chunks.try_recv() {
                Ok(chunk) => {
                    self.chunk = chunk;
                    self.at = 0;
                }
                Err(TryRecvError::Empty) => return Some(0.0),
                Err(TryRecvError::Disconnected) => self.open = false,
            }
        }
    }
}

pub struct Resampled {
    stream: Stream,
    step: f64,
    frac: f64,
    kernel: Vec<f32>,
    near: VecDeque<f32>,
    ahead: usize,
    open: bool,
}

impl Resampled {
    fn pull(&mut self) -> Option<f32> {
        let sample = self.open.then(|| self.stream.next()).flatten();
        self.open = sample.is_some();
        sample
    }

    fn prime(&mut self) -> bool {
        self.near.extend(std::iter::repeat_n(0.0, HALF - 1));
        let mut real = 0;
        while self.near.len() < TAPS {
            let sample = self.pull();
            real += sample.is_some() as usize;
            self.near.push_back(sample.unwrap_or(0.0));
        }
        self.ahead = real.saturating_sub(1);
        real > 0
    }

    fn advance(&mut self) -> bool {
        let sample = self.pull();
        if sample.is_none() {
            if self.ahead == 0 {
                return false;
            }
            self.ahead -= 1;
        }
        self.near.pop_front();
        self.near.push_back(sample.unwrap_or(0.0));
        true
    }

    fn value(&self) -> f32 {
        let at = self.frac * PHASES as f64;
        let row = (at as usize).min(PHASES - 1);
        let mix = (at - row as f64) as f32;
        let here = &self.kernel[row * TAPS..][..TAPS];
        let next = &self.kernel[(row + 1) * TAPS..][..TAPS];
        self.near
            .iter()
            .zip(here.iter().zip(next))
            .map(|(sample, (a, b))| sample * (a + (b - a) * mix))
            .sum()
    }
}

impl Iterator for Resampled {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.kernel.is_empty() {
            return self.stream.next();
        }
        if self.near.is_empty() && !self.prime() {
            self.kernel.clear();
            return None;
        }
        while self.frac >= 1.0 {
            if !self.advance() {
                self.kernel.clear();
                return None;
            }
            self.frac -= 1.0;
        }
        let value = self.value();
        self.frac += self.step;
        Some(value)
    }
}

fn kernel(step: f64) -> Vec<f32> {
    let cutoff = (1.0 / step).min(1.0);
    let mut taps = Vec::with_capacity((PHASES + 1) * TAPS);
    for phase in 0..=PHASES {
        let frac = phase as f64 / PHASES as f64;
        let row: Vec<f64> = (0..TAPS)
            .map(|tap| {
                let x = tap as f64 - (HALF - 1) as f64 - frac;
                sinc(x * cutoff) * window(x / HALF as f64)
            })
            .collect();
        let gain: f64 = row.iter().sum();
        taps.extend(row.iter().map(|tap| (tap / gain) as f32));
    }
    taps
}

fn sinc(x: f64) -> f64 {
    if x.abs() < 1e-9 {
        1.0
    } else {
        (PI * x).sin() / (PI * x)
    }
}

fn window(x: f64) -> f64 {
    if x.abs() >= 1.0 {
        0.0
    } else {
        bessel(KAISER * (1.0 - x * x).sqrt()) / bessel(KAISER)
    }
}

fn bessel(x: f64) -> f64 {
    let mut term = 1.0;
    let mut sum = 1.0;
    for k in 1..32 {
        term *= (x / 2.0 / k as f64).powi(2);
        sum += term;
    }
    sum
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stream_plays_chunks_in_order_and_ends_when_the_feed_is_gone() {
        let (feed, mut stream) = Stream::open(24000);
        feed.push(vec![0.1, 0.2]);
        feed.push(vec![0.3]);
        drop(feed);
        let heard: Vec<f32> = stream.by_ref().collect();
        assert_eq!(heard, vec![0.1, 0.2, 0.3]);
        assert_eq!(stream.next(), None);
    }

    #[test]
    fn a_stream_waits_in_silence_for_the_next_chunk() {
        let (feed, mut stream) = Stream::open(24000);
        feed.push(vec![0.5]);
        assert_eq!(stream.next(), Some(0.5));
        assert_eq!(stream.next(), Some(0.0));
        feed.push(vec![0.7]);
        assert_eq!(stream.next(), Some(0.7));
        drop(feed);
        assert_eq!(stream.next(), None);
    }

    #[test]
    fn a_clip_is_a_closed_stream() {
        let clip = Clip {
            samples: vec![0.25; 10],
            rate: 22050,
        };
        let stream = Stream::from(clip);
        assert_eq!(stream.rate(), 22050);
        assert_eq!(stream.count(), 10);
    }

    #[test]
    fn resampling_keeps_the_length_and_the_shape() {
        let rate = 24000;
        let tone = |i: usize| (2.0 * std::f32::consts::PI * 200.0 * i as f32 / rate as f32).sin();
        let (feed, stream) = Stream::open(rate);
        for chunk in 0..10 {
            feed.push((0..2400).map(|i| tone(chunk * 2400 + i)).collect());
        }
        drop(feed);
        let out: Vec<f32> = stream.at_rate(48000).collect();
        assert!((out.len() as i64 - 48000).abs() <= 2, "{}", out.len());
        let worst = out[..out.len() - 2]
            .iter()
            .enumerate()
            .map(|(i, s)| {
                let ideal = (2.0 * std::f32::consts::PI * 200.0 * i as f32 / 48000.0).sin();
                (s - ideal).abs()
            })
            .fold(0.0f32, f32::max);
        assert!(worst < 0.01, "{worst}");
    }

    #[test]
    fn a_high_tone_keeps_its_shape_at_a_rate_that_is_not_a_multiple() {
        let tone =
            |i: usize, rate: f32| (2.0 * std::f32::consts::PI * 9000.0 * i as f32 / rate).sin();
        let (feed, stream) = Stream::open(24000);
        feed.push((0..24000).map(|i| 0.5 * tone(i, 24000.0)).collect());
        drop(feed);
        let out: Vec<f32> = stream.at_rate(44100).collect();
        assert!((out.len() as i64 - 44100).abs() <= 2, "{}", out.len());
        let worst = out[2000..42000]
            .iter()
            .enumerate()
            .map(|(i, s)| (s - 0.5 * tone(i + 2000, 44100.0)).abs())
            .fold(0.0f32, f32::max);
        assert!(worst < 0.01, "{worst}");
    }

    #[test]
    fn a_lower_rate_drops_what_it_cannot_carry() {
        let tone = |i: usize| (2.0 * std::f32::consts::PI * 10000.0 * i as f32 / 24000.0).sin();
        let (feed, stream) = Stream::open(24000);
        feed.push((0..24000).map(tone).collect());
        drop(feed);
        let out: Vec<f32> = stream.at_rate(16000).collect();
        assert!((out.len() as i64 - 16000).abs() <= 2, "{}", out.len());
        let loudest = out[1000..15000].iter().fold(0.0f32, |a, s| a.max(s.abs()));
        assert!(loudest < 0.01, "{loudest}");
    }

    #[test]
    fn a_stream_with_gaps_keeps_going_through_the_resampler() {
        let (feed, stream) = Stream::open(24000);
        feed.push(vec![0.25; 100]);
        let mut out = stream.at_rate(48000);
        let first: Vec<f32> = out.by_ref().take(300).collect();
        assert_eq!(first.len(), 300);
        feed.push(vec![0.25; 100]);
        drop(feed);
        assert!(out.count() > 100);
    }

    #[test]
    fn the_same_rate_passes_samples_through() {
        let clip = Clip {
            samples: vec![0.1, -0.2, 0.3],
            rate: 24000,
        };
        let out: Vec<f32> = Stream::from(clip).at_rate(24000).collect();
        assert_eq!(out, vec![0.1, -0.2, 0.3]);
    }
}
