use std::time::{Duration, Instant};

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
