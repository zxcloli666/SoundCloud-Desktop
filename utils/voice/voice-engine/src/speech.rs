use std::time::{Duration, Instant};

use crate::stream::Feed;

const FRAMES: u32 = 30;
const GAP: f32 = 0.02;

pub struct Speech {
    pub r#gen: u64,
    rate: u32,
    feed: Option<Feed>,
    levels: Levels,
    started: Instant,
    dry: Instant,
    tick: Option<Instant>,
    silent: bool,
    voiced: usize,
    waited: f32,
    gaps: u32,
}

struct Levels {
    window: usize,
    sum: f32,
    count: usize,
    done: Vec<f32>,
}

impl Speech {
    pub fn new(r#gen: u64, rate: u32, feed: Feed, now: Instant) -> Speech {
        Speech {
            r#gen,
            rate,
            feed: Some(feed),
            levels: Levels::new(rate),
            started: now,
            dry: now,
            tick: None,
            silent: true,
            voiced: 0,
            waited: 0.0,
            gaps: 0,
        }
    }

    pub fn take(&mut self, samples: Vec<f32>, now: Instant) {
        let Some(feed) = &self.feed else {
            return;
        };
        let rate = self.rate.max(1) as f32;
        let gap = now.saturating_duration_since(self.dry).as_secs_f32();
        if self.voiced > 0 && gap >= GAP {
            self.waited += gap;
            self.gaps += 1;
        }
        self.voiced += samples.len();
        self.levels.rest((gap * rate) as usize);
        self.levels.push(&samples);
        self.dry = self.dry.max(now) + Duration::from_secs_f32(samples.len() as f32 / rate);
        self.tick.get_or_insert(now);
        feed.push(samples);
    }

    pub fn close(&mut self) {
        self.feed = None;
    }

    pub fn open(&self) -> bool {
        self.feed.is_some()
    }

    pub fn dry(&self) -> Instant {
        self.dry
    }

    pub fn lead(&self, now: Instant) -> f32 {
        self.dry.saturating_duration_since(now).as_secs_f32()
    }

    pub fn starved(&self, now: Instant) -> f32 {
        now.saturating_duration_since(self.dry).as_secs_f32()
    }

    pub fn tick(&self) -> Option<Instant> {
        self.tick
    }

    pub fn voiced(&self) -> Duration {
        Duration::from_secs_f32(self.voiced as f32 / self.rate.max(1) as f32)
    }

    pub fn waited(&self) -> (Duration, u32) {
        (Duration::from_secs_f32(self.waited), self.gaps)
    }

    pub fn level(&mut self, now: Instant) -> Option<f32> {
        if self.tick.is_none_or(|at| now < at) {
            return None;
        }
        let elapsed = now.saturating_duration_since(self.started);
        let index = (elapsed.as_secs_f64() * FRAMES as f64) as usize;
        let rms = self.levels.done.get(index).copied().unwrap_or(0.0);
        let next = self.started + Duration::from_secs_f64((index + 1) as f64 / FRAMES as f64);
        self.tick = (now < self.dry || rms != 0.0).then_some(next);
        let repeated = self.silent && rms == 0.0;
        self.silent = rms == 0.0;
        (!repeated).then_some(rms)
    }
}

impl Levels {
    fn new(rate: u32) -> Levels {
        Levels {
            window: (rate / FRAMES).max(1) as usize,
            sum: 0.0,
            count: 0,
            done: Vec::new(),
        }
    }

    fn push(&mut self, samples: &[f32]) {
        for sample in samples {
            self.step(*sample);
        }
    }

    fn rest(&mut self, samples: usize) {
        for _ in 0..samples {
            self.step(0.0);
        }
    }

    fn step(&mut self, sample: f32) {
        self.sum += sample * sample;
        self.count += 1;
        if self.count == self.window {
            self.done.push((self.sum / self.window as f32).sqrt());
            self.sum = 0.0;
            self.count = 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stream::Stream;

    const RATE: u32 = 24000;

    fn loud(seconds: f32) -> Vec<f32> {
        vec![0.5; (RATE as f32 * seconds) as usize]
    }

    fn after(start: Instant, seconds: f32) -> Instant {
        start + Duration::from_secs_f32(seconds)
    }

    #[test]
    fn levels_follow_the_loudness_across_chunks() {
        let mut levels = Levels::new(RATE);
        levels.push(&vec![0.5; 400]);
        levels.push(&vec![0.5; 400]);
        levels.push(&vec![0.0; 800]);
        assert_eq!(levels.done.len(), 2);
        assert!((levels.done[0] - 0.5).abs() < 1e-4);
        assert_eq!(levels.done[1], 0.0);
    }

    #[test]
    fn queued_speech_runs_dry_when_it_was_all_played() {
        let start = Instant::now();
        let (feed, _stream) = Stream::open(RATE);
        let mut speech = Speech::new(1, RATE, feed, start);
        speech.take(loud(1.0), start);
        speech.take(loud(0.5), after(start, 0.2));
        assert!((speech.lead(after(start, 0.2)) - 1.3).abs() < 0.01);
        assert_eq!(speech.lead(after(start, 2.0)), 0.0);
        speech.take(loud(1.0), after(start, 3.0));
        assert!((speech.lead(after(start, 3.0)) - 1.0).abs() < 0.01);
        assert_eq!(speech.dry(), after(start, 4.0));
    }

    #[test]
    fn the_level_is_silent_over_a_gap_and_loud_again_after_it() {
        let start = Instant::now();
        let (feed, _stream) = Stream::open(RATE);
        let mut speech = Speech::new(1, RATE, feed, start);
        speech.take(loud(1.0), start);
        speech.take(loud(1.0), after(start, 3.0));
        assert_eq!(speech.level(after(start, 0.5)), Some(0.5));
        assert_eq!(speech.level(after(start, 2.0)), Some(0.0));
        assert_eq!(speech.level(after(start, 3.5)), Some(0.5));
    }

    #[test]
    fn silence_is_reported_once_and_ticks_stop_until_more_speech() {
        let start = Instant::now();
        let (feed, _stream) = Stream::open(RATE);
        let mut speech = Speech::new(1, RATE, feed, start);
        assert_eq!(speech.tick(), None);
        speech.take(loud(1.0), start);
        assert_eq!(speech.tick(), Some(start));
        assert_eq!(speech.level(after(start, 0.5)), Some(0.5));
        assert!(speech.tick().is_some());
        assert_eq!(speech.level(after(start, 1.2)), Some(0.0));
        assert_eq!(speech.tick(), None);
        assert_eq!(speech.level(after(start, 1.5)), None);
        speech.take(loud(1.0), after(start, 2.0));
        assert_eq!(speech.tick(), Some(after(start, 2.0)));
        assert_eq!(speech.level(after(start, 2.5)), Some(0.5));
    }

    #[test]
    fn a_closed_speech_takes_no_more() {
        let start = Instant::now();
        let (feed, stream) = Stream::open(RATE);
        let mut speech = Speech::new(1, RATE, feed, start);
        speech.take(loud(0.1), start);
        assert!(speech.open());
        speech.close();
        speech.take(loud(0.1), start);
        assert!(!speech.open());
        assert_eq!(stream.count(), 2400);
    }
}
