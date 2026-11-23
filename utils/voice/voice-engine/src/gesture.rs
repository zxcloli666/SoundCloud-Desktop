use std::time::{Duration, Instant};

use crate::config::Headset;

pub const WINDOW: Duration = Duration::from_millis(450);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Press {
    First,
    More,
    Gesture,
}

#[derive(Default)]
pub struct Presses {
    count: u8,
    last: Option<Instant>,
}

impl Presses {
    pub fn press(&mut self, need: u8, now: Instant) -> Press {
        let chained = self
            .last
            .is_some_and(|last| now.saturating_duration_since(last) <= WINDOW);
        self.count = if chained { self.count + 1 } else { 1 };
        self.last = Some(now);
        if need >= 2 && self.count >= need {
            self.count = 0;
            self.last = None;
            return Press::Gesture;
        }
        if self.count == 1 {
            Press::First
        } else {
            Press::More
        }
    }
}

pub const LEARN_FOR: Duration = Duration::from_secs(20);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Signal {
    Toggle,
    Next,
    Previous,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Learned {
    Bound(Headset),
    Single,
}

impl Learned {
    pub fn name(self) -> &'static str {
        match self {
            Learned::Bound(headset) => headset.name(),
            Learned::Single => "single",
        }
    }
}

pub struct Learner {
    until: Instant,
    toggles: u8,
    last: Option<Instant>,
}

impl Learner {
    pub fn new(now: Instant) -> Self {
        Self {
            until: now + LEARN_FOR,
            toggles: 0,
            last: None,
        }
    }

    pub fn live(&self, now: Instant) -> bool {
        now < self.until
    }

    pub fn push(&mut self, signal: Signal, now: Instant) -> Option<Learned> {
        let skip = match signal {
            Signal::Next => Headset::Next,
            Signal::Previous => Headset::Previous,
            Signal::Toggle => {
                let chained = self
                    .last
                    .is_some_and(|last| now.saturating_duration_since(last) <= WINDOW);
                self.toggles = if chained { self.toggles + 1 } else { 1 };
                self.last = Some(now);
                return None;
            }
        };
        self.toggles = 0;
        self.last = None;
        Some(Learned::Bound(skip))
    }

    pub fn settle(&mut self, now: Instant) -> Option<Learned> {
        let last = self.last?;
        if now.saturating_duration_since(last) <= WINDOW {
            return None;
        }
        self.last = None;
        Some(match std::mem::take(&mut self.toggles) {
            0 | 1 => Learned::Single,
            2 => Learned::Bound(Headset::Double),
            _ => Learned::Bound(Headset::Triple),
        })
    }
}
