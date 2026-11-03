use std::sync::Arc;
use std::sync::atomic::Ordering;

use cpal::{FromSample, Sample};
use rodio::Source;
use rodio::mixer::MixerSource;

use super::Master;
use super::ring::Ring;

const DUCK_GLIDE_SECS: f32 = 0.04;
const SNAP: f32 = 1e-4;
const TAP_CHUNK: usize = 256;

pub struct Render {
    master: Arc<Master>,
    music: MixerSource,
    voice: MixerSource,
    channels: usize,
    channel: usize,
    gain: f32,
    glide: f32,
    speaking: bool,
    tap: Tap,
}

struct Tap {
    channels: f32,
    sum: f32,
    chunk: [f32; TAP_CHUNK],
    len: usize,
}

impl Render {
    pub fn new(master: Arc<Master>, music: MixerSource, voice: MixerSource) -> Self {
        let channels = music.channels().get() as usize;
        let rate = music.sample_rate().get();
        master.reference_rate.store(rate, Ordering::Relaxed);
        Self {
            gain: master.duck_level(),
            glide: 1.0 - (-1.0 / (DUCK_GLIDE_SECS * rate as f32)).exp(),
            master,
            music,
            voice,
            channels,
            channel: 0,
            speaking: false,
            tap: Tap {
                channels: channels as f32,
                sum: 0.0,
                chunk: [0.0; TAP_CHUNK],
                len: 0,
            },
        }
    }

    pub fn fill<T: Sample + FromSample<f32>>(&mut self, data: &mut [T]) {
        let master = self.master.clone();
        let target = master.duck_level();
        let reference = master.reference();
        for out in data.iter_mut() {
            *out = T::from_sample(self.next_sample(target, reference));
        }
        if let Some(ring) = reference {
            self.tap.flush(ring);
        }
    }

    fn next_sample(&mut self, target: f32, reference: Option<&Ring>) -> f32 {
        if self.channel == 0 {
            self.glide_gain(target);
            self.speaking = self.master.is_speaking();
        }
        let mut sample = self.music.next().unwrap_or(0.0) * self.gain;
        if self.speaking {
            sample += self.voice.next().unwrap_or(0.0);
        }
        self.channel += 1;
        let frame_done = self.channel == self.channels;
        if frame_done {
            self.channel = 0;
        }
        if let Some(ring) = reference {
            self.tap.add(sample, frame_done, ring);
        }
        sample
    }

    fn glide_gain(&mut self, target: f32) {
        self.gain += (target - self.gain) * self.glide;
        if (self.gain - target).abs() < SNAP {
            self.gain = target;
        }
    }
}

impl Tap {
    fn add(&mut self, sample: f32, frame_done: bool, ring: &Ring) {
        self.sum += sample;
        if !frame_done {
            return;
        }
        self.chunk[self.len] = self.sum / self.channels;
        self.sum = 0.0;
        self.len += 1;
        if self.len == TAP_CHUNK {
            self.flush(ring);
        }
    }

    fn flush(&mut self, ring: &Ring) {
        ring.push(&self.chunk[..self.len]);
        self.len = 0;
    }
}
