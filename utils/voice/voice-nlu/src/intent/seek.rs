use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::numbers;
use crate::types::Intent;

struct Time {
    secs: u32,
    found: bool,
    clock: bool,
    bare: Option<u32>,
}

fn time(c: &Ctx) -> Time {
    let mut t = Time { secs: 0, found: false, clock: false, bare: None };
    let n = c.len();
    let mut i = 0;
    while i < n {
        let w = c.w[i];
        if let Some(v) = numbers::clock(w) {
            t.secs += v;
            t.found = true;
            t.clock = true;
            i += 1;
            continue;
        }
        if HALF_MINUTE.contains(&w) {
            t.secs += 30;
            t.found = true;
            i += 1;
            continue;
        }
        let (count, unit_at) = match numbers::value(w) {
            Some(v) => (Some(v), i + 1),
            None => (None, i),
        };
        let unit = c.w.get(unit_at).copied().unwrap_or("");
        if SEC_UNITS.contains(&unit) {
            t.secs += count.unwrap_or(1);
            t.found = true;
            i = unit_at + 1;
        } else if MIN_UNITS.contains(&unit) {
            t.secs += count.unwrap_or(1) * 60;
            t.found = true;
            i = unit_at + 1;
            if let Some(extra) = c.w.get(i).and_then(|w| numbers::value(w)) {
                let followed = c.w.get(i + 1).is_some_and(|u| SEC_UNITS.contains(u) || MIN_UNITS.contains(u));
                if !followed {
                    t.secs += extra;
                    t.clock = true;
                    i += 1;
                }
            }
        } else if let Some(v) = count {
            t.bare = Some(v);
            i += 1;
        } else {
            i += 1;
        }
    }
    t
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 10 {
        return None;
    }
    let t = time(c);
    let fwd = c.has(FORWARD);
    let back = c.has(BACKWARD);
    let seek_verb = c.has(SEEK_VERBS) || c.has_stem(&["перемот", "промот", "отмот"]);
    let jump_verb = c.has(JUMP_VERBS);
    let skip_verb = c.has(SKIP_VERBS);
    let back_verb = c.has(BACK_VERBS) || c.has_stem(&["отмот"]);
    let has_dir = (fwd && c.at(0) != "дальше") || back || (fwd && t.found);

    let triggered = if t.found || t.bare.is_some() {
        seek_verb || jump_verb || ((skip_verb || has_dir) && t.found)
    } else {
        seek_verb && c.len() <= 4
    };

    if triggered {
        let secs = if t.found { t.secs } else { t.bare.unwrap_or(10) };
        let intent = if t.clock || jump_verb {
            Intent::SeekTo
        } else if back || back_verb {
            Intent::SeekBackward
        } else {
            Intent::SeekForward
        };
        let secs = if !t.found && t.bare.is_none() && intent != Intent::SeekTo { 10 } else { secs };
        return Some(Detected::new(intent, vec![]).number(secs));
    }

    if c.len() <= 5 && (c.has(RESTART) || c.has(&["начала"])) && !t.found {
        if c.has(&["сначала", "заново", "restart"]) || (c.has(&["с", "в"]) && c.has(&["начала", "начало"])) {
            return Some(Detected::new(Intent::SeekTo, vec![]).number(0));
        }
    }
    None
}
