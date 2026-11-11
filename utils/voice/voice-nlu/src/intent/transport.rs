use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

fn base(c: &Ctx, i: usize) -> Vec<usize> {
    let mut used = vec![i];
    used.extend((0..c.len()).filter(|&j| {
        PLAY_STRONG.contains(&c.w[j])
            || matches!(c.w[j], "верни" | "вернуть" | "верну" | "переключи")
    }));
    used
}

fn complaint(c: &Ctx) -> bool {
    let marked = c.has(COMPLAINT) || (c.has(&["не"]) && c.has(&["то"]));
    marked
        && c.w.iter().all(|w| {
            COMPLAINT.contains(w)
                || COMPLAINT_REST.contains(w)
                || PRE.contains(w)
                || GENERIC.contains(w)
        })
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 6 {
        return None;
    }
    if complaint(c) {
        return Some(Detected::new(Intent::Next, vec![]));
    }
    if c.has(&["сними", "снимай", "убери"]) && c.has_stem(&["пауз"]) && c.len() <= 4
    {
        return Some(Detected::new(Intent::Resume, vec![]));
    }
    if c.has(STOP_WORDS)
        && c.w.iter().all(|w| {
            STOP_WORDS.contains(w)
                || PRE.contains(w)
                || GENERIC.contains(w)
                || COMPLAINT_REST.contains(w)
        })
        && c.has(JUNK)
    {
        return Some(Detected::new(Intent::Stop, vec![]));
    }
    if let Some(i) = c.pos_stem(PREV_STRONG).filter(|_| !c.has_stem(NEXT_STRONG)) {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Previous, vec![i]));
        }
    }
    if let Some(i) = c.pos_stem(NEXT_STRONG) {
        if c.stray_words(&base(c, i))
            .iter()
            .all(|w| NEXT_WEAK.contains(w))
        {
            return Some(Detected::new(Intent::Next, vec![i]));
        }
    }
    if let Some(i) = c
        .pos_stem(&["пауз", "запауз", "pause"])
        .or_else(|| c.pos(PAUSE_WORDS))
    {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Pause, vec![i]));
        }
    }
    if let Some(i) = c.pos_stem(&["стоп", "stop"]).or_else(|| c.pos(STOP_WORDS)) {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Stop, vec![i]));
        }
    }
    if plays_on(c) {
        return Some(Detected::new(Intent::Resume, vec![]));
    }
    if let Some(i) = c.pos(RESUME_WORDS) {
        let strays = c.stray_words(&base(c, i));
        if strays.len() <= 1
            && !strays
                .iter()
                .any(|w| w.ends_with('й') || w.ends_with("йте"))
        {
            return Some(Detected::new(Intent::Resume, vec![i]));
        }
    }
    if let Some(i) = c.pos(NEXT_WEAK) {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Next, vec![i]));
        }
    }
    if let Some(i) = c
        .pos(PREV_WEAK)
        .filter(|&i| !(c.w[i] == "обратно" && c.has(PLAY_STRONG)))
    {
        if c.stray(&base(c, i)) == 0 {
            return Some(Detected::new(Intent::Previous, vec![i]));
        }
    }
    None
}

fn plays_on(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        PLAYING_ON.contains(&c.w[i - 1]) && c.w[i] == "дальше" && c.stray(&[i - 1, i]) == 0
    })
}
