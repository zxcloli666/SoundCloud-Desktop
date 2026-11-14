use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, SyncSender, sync_channel};
use std::time::Duration;

use rodio::Source;

use super::Master;
use crate::audio::types::{ChannelCount, SampleRate};

pub struct Speech {
    stop: Arc<AtomicBool>,
    ended: Receiver<()>,
}

pub struct OneShot<S> {
    source: S,
    stop: Arc<AtomicBool>,
    ended: SyncSender<()>,
    master: Arc<Master>,
}

pub fn start<S: Source>(source: S, master: Arc<Master>) -> (Speech, OneShot<S>) {
    let stop = Arc::new(AtomicBool::new(false));
    let (ended_tx, ended) = sync_channel(1);
    master.speaking.fetch_add(1, Ordering::Relaxed);
    let speech = Speech {
        stop: stop.clone(),
        ended,
    };
    let shot = OneShot {
        source,
        stop,
        ended: ended_tx,
        master,
    };
    (speech, shot)
}

impl Speech {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }

    pub fn ended(&self) -> &Receiver<()> {
        &self.ended
    }
}

impl<S: Source> Iterator for OneShot<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        if self.stop.load(Ordering::Relaxed) {
            return None;
        }
        self.source.next()
    }
}

impl<S: Source> Source for OneShot<S> {
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
}

impl<S> Drop for OneShot<S> {
    fn drop(&mut self) {
        self.master.speaking.fetch_sub(1, Ordering::Relaxed);
        self.ended.try_send(()).ok();
    }
}
