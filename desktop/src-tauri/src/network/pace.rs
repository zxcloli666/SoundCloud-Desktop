use std::collections::VecDeque;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

const QUICK_SILENCE: Duration = Duration::from_secs(2);
const PATIENT_SILENCE: Duration = Duration::from_secs(5);
const SLOW_LINK: Duration = Duration::from_millis(800);
const SAMPLES: usize = 8;
const MIN_SAMPLES: usize = 2;

static ANSWERS: LazyLock<Mutex<Answers>> = LazyLock::new(Mutex::default);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Pace {
    Quick,
    Patient,
}

impl Pace {
    pub fn silence(self) -> Duration {
        match self {
            Pace::Quick => QUICK_SILENCE,
            Pace::Patient => PATIENT_SILENCE,
        }
    }
}

#[derive(Default)]
struct Answers(VecDeque<Duration>);

impl Answers {
    fn note(&mut self, took: Duration) {
        if self.0.len() == SAMPLES {
            self.0.pop_front();
        }
        self.0.push_back(took);
    }

    fn pace(&self) -> Pace {
        if self.0.len() < MIN_SAMPLES {
            return Pace::Quick;
        }
        let mut sorted: Vec<Duration> = self.0.iter().copied().collect();
        sorted.sort_unstable();
        if sorted[(sorted.len() - 1) / 2] >= SLOW_LINK {
            Pace::Patient
        } else {
            Pace::Quick
        }
    }
}

fn answers() -> std::sync::MutexGuard<'static, Answers> {
    ANSWERS.lock().unwrap_or_else(|poison| poison.into_inner())
}

pub fn note(took: Duration) {
    answers().note(took);
}

pub fn now() -> Pace {
    answers().pace()
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::{Answers, Pace, SAMPLES};

    fn ms(value: u64) -> Duration {
        Duration::from_millis(value)
    }

    fn fed(samples: &[u64]) -> Answers {
        let mut answers = Answers::default();
        for sample in samples {
            answers.note(ms(*sample));
        }
        answers
    }

    #[test]
    fn a_link_answering_in_over_a_second_gets_the_patient_pings() {
        let jitter = fed(&[4_600, 1_300, 1_900, 1_100, 2_200, 1_600]);
        assert_eq!(jitter.pace(), Pace::Patient);
        assert!(Pace::Patient.silence() >= Duration::from_secs(5));
    }

    #[test]
    fn a_fast_link_keeps_the_quick_pings_for_a_volume_cut() {
        assert_eq!(fed(&[90, 70, 65, 80]).pace(), Pace::Quick);
        assert_eq!(fed(&[1_150, 330, 340]).pace(), Pace::Quick);
        assert!(Pace::Quick.silence() <= Duration::from_secs(2));
    }

    #[test]
    fn one_cold_answer_is_not_enough_to_slow_down() {
        assert_eq!(fed(&[]).pace(), Pace::Quick);
        assert_eq!(fed(&[4_500]).pace(), Pace::Quick);
        assert_eq!(fed(&[4_500, 1_500]).pace(), Pace::Patient);
    }

    #[test]
    fn the_pace_follows_the_latest_answers() {
        let mut answers = fed(&[60; SAMPLES]);
        for _ in 0..SAMPLES / 2 {
            answers.note(ms(3_000));
        }
        assert_eq!(answers.pace(), Pace::Quick);
        answers.note(ms(3_000));
        assert_eq!(answers.pace(), Pace::Patient);
        for _ in 0..SAMPLES / 2 {
            answers.note(ms(70));
        }
        assert_eq!(answers.pace(), Pace::Quick);
    }
}
