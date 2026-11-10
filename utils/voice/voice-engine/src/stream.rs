use std::sync::mpsc::{Receiver, Sender, TryRecvError, channel};

use crate::clip::Clip;

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

    pub fn at_rate(mut self, rate: u32) -> Resampled {
        let step = self.rate as f64 / rate.max(1) as f64;
        let left = self.next();
        let right = self.next();
        Resampled {
            stream: self,
            step,
            frac: 0.0,
            left,
            right,
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
    left: Option<f32>,
    right: Option<f32>,
}

impl Iterator for Resampled {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        while self.frac >= 1.0 {
            self.left = self.right;
            self.right = self.stream.next();
            self.frac -= 1.0;
        }
        let left = self.left?;
        let right = self.right.unwrap_or(left);
        let value = left + (right - left) * self.frac as f32;
        self.frac += self.step;
        Some(value)
    }
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
    fn the_same_rate_passes_samples_through() {
        let clip = Clip {
            samples: vec![0.1, -0.2, 0.3],
            rate: 24000,
        };
        let out: Vec<f32> = Stream::from(clip).at_rate(24000).collect();
        assert_eq!(out, vec![0.1, -0.2, 0.3]);
    }
}
