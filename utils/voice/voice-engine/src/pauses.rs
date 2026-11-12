use std::collections::VecDeque;

use crate::sentences::{CLAUSE_MARKS, CLOSERS, ENDS};

const WINDOW: f32 = 0.01;
const QUIET: f32 = 0.006;
const RELEASE: f32 = 0.06;
const ATTACK: f32 = 0.02;
const KEPT: f32 = 0.09;
const SHARE: f32 = 0.4;
const HELD: f32 = 2.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mark {
    Start,
    Word,
    Clause,
    Sentence,
}

impl Mark {
    pub fn of(text: &str) -> Mark {
        let said = text.trim_end_matches(|c: char| c.is_whitespace() || CLOSERS.contains(&c));
        match said.chars().last() {
            Some(c) if ENDS.contains(&c) => Mark::Sentence,
            Some(c) if CLAUSE_MARKS.contains(&c) => Mark::Clause,
            _ => Mark::Word,
        }
    }

    fn pause(self) -> f32 {
        match self {
            Mark::Start => 0.0,
            Mark::Word => 0.03,
            Mark::Clause => 0.09,
            Mark::Sentence => 0.22,
        }
    }
}

pub struct Pauses {
    rate: f32,
    window: usize,
    carry: Vec<f32>,
    held: VecDeque<f32>,
    heard: usize,
    skipped: usize,
    after: Option<Mark>,
    spare: bool,
}

impl Pauses {
    pub fn new(rate: u32) -> Pauses {
        let rate = rate.max(1) as f32;
        Pauses {
            rate,
            window: ((rate * WINDOW).round() as usize).max(1),
            carry: Vec::new(),
            held: VecDeque::new(),
            heard: 0,
            skipped: 0,
            after: Some(Mark::Start),
            spare: false,
        }
    }

    pub fn line_ended(&mut self, mark: Mark) {
        let longer = |old: &Mark| old.pause() > mark.pause();
        self.after = self.after.filter(longer).or(Some(mark));
    }

    pub fn push(&mut self, samples: Vec<f32>, spare: bool) -> Vec<f32> {
        self.spare = spare;
        self.carry.extend(samples);
        let whole = self.carry.len() / self.window * self.window;
        let windows: Vec<f32> = self.carry.drain(..whole).collect();
        let mut out = Vec::with_capacity(windows.len());
        for window in windows.chunks(self.window) {
            if quiet(window) {
                self.rest(window, &mut out);
            } else {
                self.sound(window, &mut out);
            }
        }
        out
    }

    pub fn finish(&mut self) -> Vec<f32> {
        let rest = std::mem::take(&mut self.carry);
        let mut out = Vec::new();
        if !rest.is_empty() && !quiet(&rest) {
            self.sound(&rest, &mut out);
        }
        self.held.clear();
        out
    }

    fn rest(&mut self, window: &[f32], out: &mut Vec<f32>) {
        if self.after.is_none() && self.heard < self.samples(RELEASE) {
            out.extend_from_slice(window);
            self.heard += window.len();
            return;
        }
        self.held.extend(window);
        self.skipped += window.len();
        let extra = self.held.len().saturating_sub(self.samples(HELD));
        self.held.drain(..extra);
    }

    fn sound(&mut self, window: &[f32], out: &mut Vec<f32>) {
        let wanted = match self.after {
            Some(Mark::Start) => 0,
            _ if !self.spare => usize::MAX,
            Some(mark) => self.samples(mark.pause()),
            None => self.shortened(self.heard + self.skipped),
        };
        let owed = wanted.saturating_sub(self.heard).max(self.samples(ATTACK));
        let skip = self.held.len().saturating_sub(owed);
        out.extend(self.held.drain(..).skip(skip));
        out.extend_from_slice(window);
        self.heard = 0;
        self.skipped = 0;
        self.after = None;
    }

    fn shortened(&self, pause: usize) -> usize {
        let kept = self.samples(KEPT);
        let over = pause.saturating_sub(kept);
        pause.min(kept) + (over as f32 * SHARE) as usize
    }

    fn samples(&self, seconds: f32) -> usize {
        (seconds * self.rate).round() as usize
    }
}

pub fn lead_in(samples: &[f32], rate: u32) -> usize {
    let rate = rate.max(1) as f32;
    let window = ((rate * WINDOW).round() as usize).max(1);
    let still = samples.chunks(window).take_while(|w| quiet(w)).count() * window;
    still
        .min(samples.len())
        .saturating_sub((rate * ATTACK).round() as usize)
}

fn quiet(window: &[f32]) -> bool {
    let power: f32 = window.iter().map(|sample| sample * sample).sum();
    power < QUIET * QUIET * window.len() as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 24000;

    fn loud(seconds: f32) -> Vec<f32> {
        vec![0.5; (RATE as f32 * seconds) as usize]
    }

    fn still(seconds: f32) -> Vec<f32> {
        vec![0.001; (RATE as f32 * seconds) as usize]
    }

    fn speaking() -> Pauses {
        let mut pauses = Pauses::new(RATE);
        pauses.push(loud(0.5), true);
        pauses
    }

    fn silences(samples: &[f32]) -> Vec<f32> {
        let mut found = Vec::new();
        let mut run = 0;
        for sample in samples.iter().chain(&[1.0]) {
            if sample.abs() < 0.01 {
                run += 1;
            } else if run > 0 {
                found.push(run as f32 / RATE as f32);
                run = 0;
            }
        }
        found
    }

    fn said(pauses: &mut Pauses, parts: &[Vec<f32>]) -> Vec<f32> {
        let mut out = Vec::new();
        for part in parts {
            out.extend(pauses.push(part.clone(), true));
        }
        out.extend(pauses.finish());
        out
    }

    fn near(found: f32, wanted: f32) -> bool {
        (found - wanted).abs() < 0.011
    }

    #[test]
    fn speech_with_short_pauses_passes_as_it_is() {
        let parts = [loud(0.4), still(0.05), loud(0.3), still(0.09), loud(0.2)];
        let whole: Vec<f32> = parts.concat();
        assert_eq!(said(&mut speaking(), &parts), whole);
    }

    #[test]
    fn a_long_pause_inside_a_line_keeps_a_share_of_what_is_over_the_usual() {
        let heard = said(&mut speaking(), &[still(0.49), loud(0.3)]);
        let pauses = silences(&heard);
        assert_eq!(pauses.len(), 1);
        assert!(near(pauses[0], 0.25), "{pauses:?}");
        let heard = said(&mut speaking(), &[still(0.2), loud(0.3)]);
        assert!(near(silences(&heard)[0], 0.134), "{:?}", silences(&heard));
    }

    #[test]
    fn the_pause_between_two_lines_follows_the_mark_that_ended_the_first() {
        let between = |mark| {
            let mut pauses = speaking();
            let mut heard = pauses.push(still(0.3), true);
            pauses.line_ended(mark);
            heard.extend(pauses.push(still(0.2), true));
            heard.extend(pauses.push(loud(0.3), true));
            silences(&heard)[0]
        };
        assert!(near(between(Mark::Sentence), 0.22));
        assert!(near(between(Mark::Clause), 0.09));
        assert!(near(between(Mark::Word), 0.08));
    }

    #[test]
    fn a_pause_shorter_than_its_mark_allows_is_not_made_longer() {
        let mut pauses = speaking();
        let mut heard = pauses.push(still(0.04), true);
        pauses.line_ended(Mark::Sentence);
        heard.extend(pauses.push(still(0.05), true));
        heard.extend(pauses.push(loud(0.3), true));
        assert!(near(silences(&heard)[0], 0.09));
    }

    #[test]
    fn silence_before_the_first_word_is_cut_to_its_attack() {
        let mut pauses = Pauses::new(RATE);
        let heard = said(&mut pauses, &[still(0.3), loud(0.3)]);
        assert!(near(silences(&heard)[0], 0.02));
        assert_eq!(heard.len(), (RATE as f32 * 0.32) as usize);
    }

    #[test]
    fn the_silence_a_line_opens_with_may_be_cut_down_to_its_attack() {
        let line: Vec<f32> = [still(0.16), loud(0.3)].concat();
        assert_eq!(lead_in(&line, RATE), (RATE as f32 * 0.14) as usize);
        assert_eq!(lead_in(&loud(0.3), RATE), 0);
        assert_eq!(lead_in(&still(0.01), RATE), 0);
        assert_eq!(lead_in(&[], RATE), 0);
    }

    #[test]
    fn pauses_stay_as_the_voice_made_them_when_no_sound_is_ready_ahead() {
        let mut pauses = Pauses::new(RATE);
        let mut heard = pauses.push(still(0.3), false);
        heard.extend(pauses.push(loud(0.5), false));
        heard.extend(pauses.push(still(0.3), false));
        pauses.line_ended(Mark::Clause);
        heard.extend(pauses.push(still(0.2), false));
        heard.extend(pauses.push(loud(0.3), false));
        heard.extend(pauses.push(still(0.4), false));
        heard.extend(pauses.push(loud(0.3), false));
        let found = silences(&heard);
        assert!(near(found[0], 0.02), "{found:?}");
        assert!(near(found[1], 0.5), "{found:?}");
        assert!(near(found[2], 0.4), "{found:?}");
    }

    #[test]
    fn silence_after_the_last_word_is_cut_to_its_release() {
        let heard = said(&mut speaking(), &[still(0.4)]);
        assert_eq!(heard.len(), (RATE as f32 * 0.06) as usize);
    }

    #[test]
    fn the_size_of_the_pieces_does_not_change_what_is_heard() {
        let whole: Vec<f32> = [loud(0.31), still(0.47), loud(0.23), still(0.2), loud(0.1)].concat();
        let at_once = said(&mut speaking(), std::slice::from_ref(&whole));
        for size in [1, 7, 240, 1000, 4801] {
            let pieces: Vec<Vec<f32>> = whole.chunks(size).map(<[f32]>::to_vec).collect();
            assert_eq!(said(&mut speaking(), &pieces), at_once, "{size}");
        }
    }

    #[test]
    fn a_line_is_marked_by_the_sign_it_ends_with() {
        assert_eq!(Mark::of("Включаю Кино."), Mark::Sentence);
        assert_eq!(Mark::of("Что включить?»"), Mark::Sentence);
        assert_eq!(Mark::of("Ну вот… "), Mark::Sentence);
        assert_eq!(Mark::of("Привет! У меня всё отлично,"), Mark::Clause);
        assert_eq!(Mark::of("Первый вышел на прошлой неделе —"), Mark::Clause);
        assert_eq!(Mark::of("слово за словом без конца"), Mark::Word);
        assert_eq!(Mark::of(""), Mark::Word);
    }
}
