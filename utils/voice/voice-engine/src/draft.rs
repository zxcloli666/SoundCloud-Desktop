use std::time::Instant;

use crate::{pauses, qwen};

const BURST: f32 = 0.64;
const HEADROOM: f32 = 1.2;

pub struct Draft {
    pub rate: u32,
    pub samples: Vec<f32>,
    expected: f32,
    first: Option<(Instant, usize)>,
}

impl Draft {
    pub fn new(text: &str) -> Draft {
        Draft {
            rate: 0,
            samples: Vec::new(),
            expected: qwen::seconds(text),
            first: None,
        }
    }

    pub fn take(&mut self, rate: u32, samples: Vec<f32>, now: Instant) {
        if self.first.is_none() {
            self.first = Some((now, samples.len()));
        }
        self.rate = rate;
        self.samples.extend(samples);
    }

    pub fn seconds(&self) -> f32 {
        self.samples.len() as f32 / self.rate.max(1) as f32
    }

    pub fn after(mut self, waited: f32) -> Vec<f32> {
        let waited = (waited * self.rate as f32) as usize;
        let cut = pauses::lead_in(&self.samples, self.rate).min(waited);
        self.samples.drain(..cut);
        self.samples
    }

    pub fn ready(&self, now: Instant, lead: f32) -> bool {
        let Some((at, opening)) = self.first else {
            return false;
        };
        let rate = self.rate.max(1) as f32;
        let waited = now.saturating_duration_since(at).as_secs_f32();
        let made = (self.samples.len() - opening) as f32 / rate;
        if made <= 0.0 {
            return false;
        }
        let pace = made / waited.max(0.001);
        let behind = (1.0 - pace).max(0.0) * self.expected * HEADROOM;
        self.samples.len() as f32 / rate + lead >= BURST / pace + behind
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    const RATE: u32 = 24000;

    fn chunk(seconds: f32) -> Vec<f32> {
        vec![0.1; (RATE as f32 * seconds) as usize]
    }

    fn draft_after(chunks: &[(f32, f32)]) -> (Draft, Instant) {
        let start = Instant::now();
        let mut draft = Draft::new("Включаю Скриптонита.");
        let mut now = start;
        for (at, seconds) in chunks {
            now = start + Duration::from_secs_f32(*at);
            draft.take(RATE, chunk(*seconds), now);
        }
        (draft, now)
    }

    #[test]
    fn one_piece_is_not_enough_to_know_the_pace() {
        let (draft, now) = draft_after(&[(0.1, 2.0)]);
        assert!(!draft.ready(now, 0.0));
        assert!(!draft.ready(now, 5.0));
    }

    #[test]
    fn a_fast_engine_starts_after_a_short_lead() {
        let (draft, now) = draft_after(&[(0.05, 0.08), (0.09, 0.16), (0.17, 0.32)]);
        assert!(draft.ready(now, 0.0));
    }

    #[test]
    fn a_real_time_engine_waits_for_one_full_burst() {
        let early = [(0.1, 0.08), (0.26, 0.16), (0.58, 0.32)];
        let (draft, now) = draft_after(&early);
        assert!(!draft.ready(now, 0.0));
        let later = [(0.1, 0.08), (0.26, 0.16), (0.58, 0.32), (1.22, 0.64)];
        let (draft, now) = draft_after(&later);
        assert!(draft.ready(now, 0.0));
    }

    #[test]
    fn a_slow_engine_buffers_most_of_the_phrase() {
        let slow = [(0.2, 0.08), (0.52, 0.16), (1.16, 0.32), (2.44, 0.64)];
        let (draft, now) = draft_after(&slow);
        assert!(!draft.ready(now, 0.0));
    }

    #[test]
    fn a_line_played_late_gives_up_the_silence_it_opens_with() {
        let line = || {
            let mut draft = Draft::new("Включаю Скриптонита.");
            draft.take(RATE, vec![0.0; 4800], Instant::now());
            draft.take(RATE, chunk(0.3), Instant::now());
            draft
        };
        assert_eq!(line().after(0.0).len(), 12000);
        assert_eq!(line().after(0.1).len(), 9600);
        assert_eq!(line().after(5.0).len(), 7680);
    }

    #[test]
    fn speech_still_queued_ahead_counts_as_buffered() {
        let early = [(0.1, 0.08), (0.26, 0.16), (0.58, 0.32)];
        let (draft, now) = draft_after(&early);
        assert!(!draft.ready(now, 0.0));
        assert!(draft.ready(now, 0.5));
        let slow = [(0.2, 0.08), (0.52, 0.16), (1.16, 0.32), (2.44, 0.64)];
        let (draft, now) = draft_after(&slow);
        assert!(!draft.ready(now, 0.5));
        assert!(draft.ready(now, 3.0));
    }
}
