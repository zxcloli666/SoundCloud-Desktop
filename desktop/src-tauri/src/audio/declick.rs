use std::time::Duration;

use rodio::source::SeekError;
use rodio::Source;

use crate::audio::types::{ChannelCount, SampleRate};

const PREROLL: Duration = Duration::from_millis(100);
const FADE: Duration = Duration::from_millis(10);

fn frames_in(duration: Duration, sample_rate: SampleRate) -> usize {
    (duration.as_secs_f64() * sample_rate.get() as f64) as usize
}

pub struct DeclickSource<S: Source<Item = f32>> {
    source: S,
    channels: ChannelCount,
    sample_rate: SampleRate,
    channel: usize,
    last: Vec<f32>,
    from: Vec<f32>,
    fade_frames: usize,
    fade_pos: usize,
}

impl<S: Source<Item = f32>> DeclickSource<S> {
    pub fn new(source: S) -> Self {
        let channels = source.channels();
        let sample_rate = source.sample_rate();
        let count = channels.get() as usize;
        Self {
            source,
            channels,
            sample_rate,
            channel: 0,
            last: vec![0.0; count],
            from: vec![0.0; count],
            fade_frames: frames_in(FADE, sample_rate),
            fade_pos: 0,
        }
    }
}

impl<S: Source<Item = f32>> Iterator for DeclickSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.source.next()?;
        let channel = self.channel;
        self.channel = (channel + 1) % self.last.len();

        let out = if self.fade_pos < self.fade_frames {
            let gain = self.fade_pos as f32 / self.fade_frames as f32;
            if self.channel == 0 {
                self.fade_pos += 1;
            }
            self.from[channel] + (sample - self.from[channel]) * gain
        } else {
            sample
        };
        self.last[channel] = out;
        Some(out)
    }
}

impl<S: Source<Item = f32>> Source for DeclickSource<S> {
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
        let preroll = pos.min(PREROLL);
        self.source.try_seek(pos - preroll)?;
        for _ in 0..frames_in(preroll, self.sample_rate) * self.last.len() {
            if self.source.next().is_none() {
                break;
            }
        }
        self.from.copy_from_slice(&self.last);
        self.fade_pos = 0;
        Ok(())
    }
}
