use std::time::{Duration, Instant};

use serde::Serialize;

const REPORT_EVERY: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Progress {
    pub received: u64,
    pub total: Option<u64>,
}

pub struct Meter<'a> {
    report: &'a (dyn Fn(Progress) + Send + Sync),
    total: Option<u64>,
    last: Option<Instant>,
}

impl<'a> Meter<'a> {
    pub fn new(report: &'a (dyn Fn(Progress) + Send + Sync), total: Option<u64>) -> Self {
        Self {
            report,
            total,
            last: None,
        }
    }

    pub fn received(&mut self, received: u64, now: Instant) {
        let whole = self.total.is_some_and(|total| received >= total);
        let fresh = self
            .last
            .is_some_and(|last| now.duration_since(last) < REPORT_EVERY);
        if fresh && !whole {
            return;
        }
        self.last = Some(now);
        (self.report)(Progress {
            received,
            total: self.total,
        });
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    use super::{Meter, Progress};

    #[test]
    fn reports_the_first_chunk_then_every_tenth_of_a_second_and_the_last_one() {
        let seen = Mutex::new(Vec::new());
        let report = |progress: Progress| seen.lock().expect("seen").push(progress.received);
        let mut meter = Meter::new(&report, Some(400));
        let start = Instant::now();
        meter.received(100, start);
        meter.received(200, start + Duration::from_millis(40));
        meter.received(300, start + Duration::from_millis(120));
        meter.received(400, start + Duration::from_millis(130));
        assert_eq!(*seen.lock().expect("seen"), [100, 300, 400]);
    }
}
