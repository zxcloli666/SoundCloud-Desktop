use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

const NAME_PLAY_VERBS: &[&str] = &[
    "включи",
    "включить",
    "включай",
    "вруби",
    "врубай",
    "запусти",
    "сыграй",
    "играй",
    "играть",
    "послушать",
    "послушаем",
    "play",
    "заведи",
    "накати",
    "завести",
];

fn names_play(c: &Ctx, word_at: usize) -> bool {
    let verb = c.w.iter().position(|w| NAME_PLAY_VERBS.contains(w));
    match verb {
        Some(v) if v < word_at => c.at(word_at.saturating_sub(1)) != "на",
        Some(_) => true,
        None => false,
    }
}

fn base(c: &Ctx, i: usize) -> Vec<usize> {
    let mut used = vec![i];
    used.extend((0..c.len()).filter(|&j| {
        PLAY_STRONG.contains(&c.w[j])
            || matches!(c.w[j], "верни" | "вернуть" | "верну" | "переключи")
    }));
    used
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 6 {
        return None;
    }
    if let Some(i) = c.pos_stem(PREV_STRONG).filter(|_| !c.has_stem(NEXT_STRONG)) {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Previous, vec![i]));
        }
    }
    if let Some(i) = c.pos_stem(NEXT_STRONG) {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Next, vec![i]));
        }
    }
    if let Some(i) = c
        .pos_stem(&["пауз", "запауз", "pause"])
        .or_else(|| c.pos(PAUSE_WORDS))
    {
        if c.stray(&base(c, i)) == 0 && !names_play(c, i) {
            return Some(Detected::new(Intent::Pause, vec![i]));
        }
    }
    if let Some(i) = c.pos_stem(&["стоп", "stop"]).or_else(|| c.pos(STOP_WORDS)) {
        if c.stray(&base(c, i)) == 0 && !names_play(c, i) {
            return Some(Detected::new(Intent::Stop, vec![i]));
        }
    }
    if let Some(i) = c.pos(RESUME_WORDS) {
        if c.stray(&base(c, i)) <= 1 {
            return Some(Detected::new(Intent::Resume, vec![i]));
        }
    }
    if let Some(i) = c.pos(NEXT_WEAK) {
        if c.stray(&base(c, i)) == 0 && !names_play(c, i) {
            return Some(Detected::new(Intent::Next, vec![i]));
        }
    }
    if let Some(i) = c.pos(PREV_WEAK) {
        if c.stray(&base(c, i)) == 0 && !names_play(c, i) {
            return Some(Detected::new(Intent::Previous, vec![i]));
        }
    }
    None
}
