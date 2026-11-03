mod chain;
mod limiter;
mod pan;
mod params;
mod reverb;
mod shelf;
#[cfg(test)]
mod tests;

use std::sync::Arc;
use std::time::Duration;

use rodio::Source;
use rodio::source::SeekError;

use chain::Chain;
pub use params::{EffectsParams, Settings};

type ChannelCount = std::num::NonZero<u16>;
type SampleRate = std::num::NonZero<u32>;

pub struct EffectsSource<S: Source<Item = f32>> {
    source: S,
    chain: Chain,
    channels: ChannelCount,
    sample_rate: SampleRate,
    pending: Option<f32>,
}

impl<S: Source<Item = f32>> EffectsSource<S> {
    pub fn new(source: S, params: Arc<EffectsParams>) -> Self {
        let channels = source.channels();
        let sample_rate = source.sample_rate();
        Self {
            source,
            chain: Chain::new(params, sample_rate.get()),
            channels,
            sample_rate,
            pending: None,
        }
    }
}

impl<S: Source<Item = f32>> Iterator for EffectsSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if let Some(right) = self.pending.take() {
            return Some(right);
        }
        let left = self.source.next()?;
        if self.channels.get() != 2 {
            return Some(left);
        }
        let Some(right) = self.source.next() else {
            return Some(left);
        };
        let (left, right) = self.chain.frame(left, right);
        self.pending = Some(right);
        Some(left)
    }
}

impl<S: Source<Item = f32>> Source for EffectsSource<S> {
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
        self.pending = None;
        self.chain.reset();
        Ok(())
    }
}
