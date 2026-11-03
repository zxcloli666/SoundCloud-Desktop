use std::collections::VecDeque;

use crate::frames::{Frame, energy};

const WARMUP_FRAMES: u32 = 30;
const MIN_ENERGY: f32 = 1e-6;
const SPEECH_RATIO: f32 = 4.0;
const CONFIRM_FRAMES: u32 = 3;
const DECIDE_FRAMES: usize = 10;
const RELEASE_FRAMES: u32 = 70;
const NOISE_ALPHA: f32 = 0.02;

enum Phase {
    Idle,
    Pending,
    Locked(usize),
}

struct Track {
    noise: f32,
    seen: u32,
    above: u32,
    hold: VecDeque<Frame>,
}

pub struct Selector {
    tracks: Vec<Track>,
    phase: Phase,
    current: usize,
    quiet: u32,
    confirmed: bool,
}

impl Selector {
    pub fn new(inputs: usize) -> Self {
        let tracks = (0..inputs)
            .map(|_| Track {
                noise: MIN_ENERGY,
                seen: 0,
                above: 0,
                hold: VecDeque::new(),
            })
            .collect();
        Self {
            tracks,
            phase: Phase::Idle,
            current: 0,
            quiet: 0,
            confirmed: false,
        }
    }

    pub fn locked(&self) -> Option<usize> {
        match self.phase {
            Phase::Locked(input) => Some(input),
            _ => None,
        }
    }

    pub fn drop_input(&mut self, input: usize) {
        self.tracks[input].hold.clear();
        self.tracks[input].seen = 0;
        if matches!(self.phase, Phase::Locked(w) if w == input) {
            self.phase = Phase::Idle;
        }
        if self.current == input
            && let Some(next) = (0..self.tracks.len()).find(|&i| i != input)
        {
            self.current = next;
        }
    }

    pub fn push(&mut self, input: usize, frame: Frame) -> Vec<(usize, Frame)> {
        let e = energy(&frame);
        let track = &mut self.tracks[input];
        track.seen = track.seen.saturating_add(1);
        let loud = track.seen > WARMUP_FRAMES && e > track.noise * SPEECH_RATIO && e > MIN_ENERGY;
        track.above = if loud { track.above + 1 } else { 0 };
        match self.phase {
            Phase::Idle => self.idle(input, frame, e, loud),
            Phase::Pending => self.pending(input, frame),
            Phase::Locked(winner) => self.locked_frame(winner, input, frame, loud),
        }
    }

    fn idle(&mut self, input: usize, frame: Frame, e: f32, loud: bool) -> Vec<(usize, Frame)> {
        let track = &mut self.tracks[input];
        if !loud {
            let alpha = if track.seen < WARMUP_FRAMES {
                0.2
            } else {
                NOISE_ALPHA
            };
            track.noise = (track.noise + (e - track.noise) * alpha).max(MIN_ENERGY);
        }
        if loud {
            self.phase = Phase::Pending;
            self.confirmed = false;
            for t in &mut self.tracks {
                t.hold.clear();
            }
            self.tracks[input].hold.push_back(frame);
            return Vec::new();
        }
        if input == self.current {
            vec![(input, frame)]
        } else {
            Vec::new()
        }
    }

    fn pending(&mut self, input: usize, frame: Frame) -> Vec<(usize, Frame)> {
        self.tracks[input].hold.push_back(frame);
        if self.tracks.iter().any(|t| t.above >= CONFIRM_FRAMES) {
            self.confirmed = true;
        }
        if self.tracks[input].hold.len() < DECIDE_FRAMES {
            return Vec::new();
        }
        if !self.confirmed {
            return self.cancel();
        }
        let winner = self.best();
        self.phase = Phase::Locked(winner);
        self.current = winner;
        self.quiet = 0;
        let held: Vec<(usize, Frame)> = self.tracks[winner]
            .hold
            .drain(..)
            .map(|f| (winner, f))
            .collect();
        for t in &mut self.tracks {
            t.hold.clear();
        }
        held
    }

    fn cancel(&mut self) -> Vec<(usize, Frame)> {
        self.phase = Phase::Idle;
        let current = self.current;
        let out = self.tracks[current]
            .hold
            .drain(..)
            .map(|f| (current, f))
            .collect();
        for t in &mut self.tracks {
            t.hold.clear();
        }
        out
    }

    fn best(&self) -> usize {
        let mut best = 0;
        let mut best_ratio = f32::MIN;
        for (i, t) in self.tracks.iter().enumerate() {
            if t.hold.is_empty() {
                continue;
            }
            let mean = t.hold.iter().map(|f| energy(f)).sum::<f32>() / t.hold.len() as f32;
            let ratio = mean / t.noise;
            if ratio > best_ratio {
                best_ratio = ratio;
                best = i;
            }
        }
        best
    }

    fn locked_frame(
        &mut self,
        winner: usize,
        input: usize,
        frame: Frame,
        loud: bool,
    ) -> Vec<(usize, Frame)> {
        if input != winner {
            return Vec::new();
        }
        self.quiet = if loud { 0 } else { self.quiet + 1 };
        if self.quiet >= RELEASE_FRAMES {
            self.phase = Phase::Idle;
        }
        vec![(winner, frame)]
    }
}
