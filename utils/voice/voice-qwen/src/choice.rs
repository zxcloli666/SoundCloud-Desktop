use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::qwen::CPU;

const BEST: &str = "best";
const HOUR: u64 = 60 * 60;
const PAUSES: [u64; 2] = [24 * HOUR, 72 * HOUR];

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Choice {
    Open,
    Best,
    Cpu,
    Stopped { times: usize, at: u64 },
}

pub fn now() -> u64 {
    let since = SystemTime::now().duration_since(UNIX_EPOCH);
    since.map_or(0, |since| since.as_secs())
}

impl Choice {
    pub fn kept(file: &Path) -> Choice {
        Choice::read(&fs::read_to_string(file).unwrap_or_default())
    }

    pub fn keep(self, file: &Path) {
        let _ = match self.written() {
            Some(text) => fs::write(file, text),
            None => fs::remove_file(file),
        };
    }

    pub fn settled(self) -> bool {
        matches!(self, Choice::Best | Choice::Cpu)
    }

    pub fn on_cpu(self, now: u64) -> bool {
        match self {
            Choice::Open | Choice::Best => false,
            Choice::Cpu => true,
            Choice::Stopped { times, at } => match pause(times) {
                Some(pause) => (at..at.saturating_add(pause)).contains(&now),
                None => true,
            },
        }
    }

    pub fn stopped(self, now: u64) -> Choice {
        let times = match self {
            Choice::Cpu => return Choice::Cpu,
            Choice::Stopped { times, .. } => times + 1,
            Choice::Open | Choice::Best => 1,
        };
        match pause(times) {
            Some(_) => Choice::Stopped { times, at: now },
            None => Choice::Cpu,
        }
    }

    pub fn lasts(self) -> String {
        let pause = match self {
            Choice::Stopped { times, .. } => pause(times),
            _ => None,
        };
        match pause {
            Some(pause) => format!("for {} h", pause / HOUR),
            None => "for good".into(),
        }
    }

    fn read(text: &str) -> Choice {
        let mut words = text.split_whitespace();
        match words.next() {
            Some(BEST) => Choice::Best,
            Some(CPU) => stop(words.next(), words.next()).unwrap_or(Choice::Cpu),
            _ => Choice::Open,
        }
    }

    fn written(self) -> Option<String> {
        match self {
            Choice::Open => None,
            Choice::Best => Some(BEST.into()),
            Choice::Cpu => Some(CPU.into()),
            Choice::Stopped { times, at } => Some(format!("{CPU} {times} {at}")),
        }
    }
}

fn stop(times: Option<&str>, at: Option<&str>) -> Option<Choice> {
    let times = times?.parse().ok()?;
    let at = at?.parse().ok()?;
    pause(times).map(|_| Choice::Stopped { times, at })
}

fn pause(times: usize) -> Option<u64> {
    PAUSES.get(times.checked_sub(1)?).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: u64 = 24 * HOUR;
    const THEN: u64 = 1_700_000_000;

    fn stopped(times: usize) -> Choice {
        Choice::Stopped { times, at: THEN }
    }

    #[test]
    fn old_files_keep_their_meaning() {
        assert_eq!(Choice::read("best"), Choice::Best);
        assert_eq!(Choice::read("CPU"), Choice::Cpu);
        assert_eq!(Choice::read("CPU\n"), Choice::Cpu);
        assert_eq!(Choice::read(""), Choice::Open);
        assert_eq!(Choice::read("MTL0"), Choice::Open);
        assert!(Choice::Cpu.on_cpu(THEN + 365 * DAY));
        assert!(!Choice::Best.on_cpu(THEN));
        assert!(Choice::Best.settled() && Choice::Cpu.settled());
        assert!(!Choice::Open.settled() && !stopped(1).settled());
    }

    #[test]
    fn a_stop_is_written_after_the_device_and_read_back() {
        for choice in [Choice::Best, Choice::Cpu, stopped(1), stopped(2)] {
            assert_eq!(Choice::read(&choice.written().unwrap()), choice);
        }
        assert_eq!(stopped(2).written().unwrap(), format!("CPU 2 {THEN}"));
        assert_eq!(Choice::Open.written(), None);
    }

    #[test]
    fn a_stop_record_that_cannot_be_read_is_the_cpu_for_good() {
        for text in ["CPU 1", "CPU x 5", "CPU 1 soon", "CPU 0 5", "CPU 3 5"] {
            assert_eq!(Choice::read(text), Choice::Cpu, "{text}");
        }
    }

    #[test]
    fn the_pause_grows_and_the_third_stop_in_a_row_is_for_good() {
        assert_eq!(Choice::Open.stopped(THEN), stopped(1));
        assert_eq!(Choice::Best.stopped(THEN), stopped(1));
        assert_eq!(
            stopped(1).stopped(THEN + DAY),
            Choice::Stopped {
                times: 2,
                at: THEN + DAY
            }
        );
        assert_eq!(stopped(2).stopped(THEN), Choice::Cpu);
        assert_eq!(Choice::Cpu.stopped(THEN), Choice::Cpu);
        assert_eq!(stopped(1).lasts(), "for 24 h");
        assert_eq!(stopped(2).lasts(), "for 72 h");
        assert_eq!(Choice::Cpu.lasts(), "for good");
    }

    #[test]
    fn the_device_is_tried_again_when_the_pause_has_passed() {
        assert!(stopped(1).on_cpu(THEN));
        assert!(stopped(1).on_cpu(THEN + DAY - 1));
        assert!(!stopped(1).on_cpu(THEN + DAY));
        assert!(stopped(2).on_cpu(THEN + 3 * DAY - 1));
        assert!(!stopped(2).on_cpu(THEN + 3 * DAY));
        assert!(!stopped(1).on_cpu(THEN - 1), "the clock went back");
    }
}
