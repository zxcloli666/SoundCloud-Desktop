use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::numbers;
use crate::types::Intent;

struct Time {
    secs: u32,
    found: bool,
    clock: bool,
    ordinal: bool,
    bare: Option<u32>,
}

fn half_after(c: &Ctx, i: usize) -> bool {
    c.at(i) == "с" && c.at(i + 1) == "половиной"
}

fn unit_secs(unit: &str) -> Option<u32> {
    if SEC_UNITS.contains(&unit) {
        Some(1)
    } else if MIN_UNITS.contains(&unit) {
        Some(60)
    } else {
        None
    }
}

fn time(c: &Ctx) -> Time {
    let mut t = Time {
        secs: 0,
        found: false,
        clock: false,
        ordinal: false,
        bare: None,
    };
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
        if ONE_AND_HALF.contains(&w) {
            if let Some(per) = unit_secs(c.at(i + 1)) {
                t.secs += per * 3 / 2;
                t.found = true;
                i += 2;
                continue;
            }
        }
        if let Some(per) = unit_secs(w) {
            let plural = matches!(w, "секунд" | "секунды" | "сек" | "минут" | "минуты" | "мин");
            let mut at = i + 1;
            if plural && c.at(at) == "на" {
                at += 1;
            }
            let given = numbers::value(c.at(at)).filter(|_| plural);
            let count = given.unwrap_or(1);
            t.secs += count * per;
            t.found = true;
            if given.is_some() {
                at += 1;
            } else if per == 60 {
                if let Some(extra) = numbers::value(c.at(at)) {
                    if unit_secs(c.at(at + 1)).is_none() {
                        t.secs += extra;
                        t.clock = true;
                        at += 1;
                    }
                }
            }
            if half_after(c, at) {
                t.secs += per / 2;
                at += 2;
            }
            i = at;
            continue;
        }
        let Some(count) = numbers::value(w) else {
            i += 1;
            continue;
        };
        let mut unit_at = i + 1;
        if c.at(unit_at) == "ордин" {
            t.ordinal = true;
            unit_at += 1;
        }
        let share = c.at(unit_at) == "доля";
        if share {
            unit_at += 1;
        }
        let halves = half_after(c, unit_at);
        if halves {
            unit_at += 2;
        }
        let Some(per) = unit_secs(c.at(unit_at)) else {
            t.bare = Some(count);
            i += 1;
            continue;
        };
        t.secs += if share {
            count * per / 100
        } else {
            count * per
        };
        if halves {
            t.secs += per / 2;
        }
        t.found = true;
        i = unit_at + 1;
        if half_after(c, i) {
            t.secs += per / 2;
            i += 2;
        } else if per == 60 {
            if let Some(extra) = numbers::value(c.at(i)) {
                let followed = unit_secs(c.at(i + 1)).is_some();
                if !followed {
                    t.secs += extra;
                    t.clock = true;
                    i += 1;
                }
            }
        }
    }
    t
}

fn vocabulary(w: &str) -> bool {
    numbers::is_number(w)
        || numbers::clock(w).is_some()
        || SEEK_FILL.contains(&w)
        || SEEK_VERBS.contains(&w)
        || JUMP_VERBS.contains(&w)
        || SKIP_VERBS.contains(&w)
        || BACK_VERBS.contains(&w)
        || SET_VERBS.contains(&w)
        || PLAY_STRONG.contains(&w)
        || FORWARD.contains(&w)
        || BACKWARD.contains(&w)
        || SEC_UNITS.contains(&w)
        || MIN_UNITS.contains(&w)
        || HALF_MINUTE.contains(&w)
        || ONE_AND_HALF.contains(&w)
        || RESTART.contains(&w)
        || PRE.contains(&w)
        || GENERIC.contains(&w)
        || TRANSPORT_VERBS.contains(&w)
        || stem(&["перемот", "промот", "отмот", "начал"], w)
}

fn foreign(c: &Ctx) -> bool {
    !c.w.iter().all(|w| vocabulary(w))
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 10 || foreign(c) {
        return None;
    }
    let t = time(c);
    let fwd = c.has(FORWARD);
    let back = c.has(BACKWARD);
    let seek_verb = c.has(SEEK_VERBS) || c.has_stem(&["перемот", "промот", "отмот"]);
    let jump_verb = c.has(JUMP_VERBS) || (c.has(&["to"]) && c.has(&["go", "skip"]));
    let set_verb = c.has(SET_VERBS) && t.found;
    let skip_verb = c.has(SKIP_VERBS);
    let back_verb = c.has(BACK_VERBS) || c.has_stem(&["отмот"]);
    let explicit_dir = back || (fwd && c.at(0) != "дальше");
    let has_dir = explicit_dir || (fwd && t.found);

    let triggered = if t.found || t.bare.is_some() {
        seek_verb
            || jump_verb
            || set_verb
            || (t.ordinal && t.found)
            || (explicit_dir && t.bare.is_some())
            || ((skip_verb || has_dir) && t.found)
    } else {
        seek_verb && c.len() <= 4
    };

    let to_start = c.len() <= 6
        && !t.found
        && (c.has(&["сначала", "заново", "restart"]) || c.has_stem(&["начал"]))
        && c.stray(&c.all(SEEK_VERBS)) <= 2;
    if to_start && !fwd {
        return Some(Detected::new(Intent::SeekTo, vec![]).number(0));
    }

    if triggered {
        let secs = if t.found {
            t.secs
        } else {
            t.bare.unwrap_or(10)
        };
        let absolute = t.ordinal || jump_verb || set_verb;
        let intent = if absolute || (t.clock && !has_dir) {
            Intent::SeekTo
        } else if back || back_verb {
            Intent::SeekBackward
        } else {
            Intent::SeekForward
        };
        let secs = if !t.found && t.bare.is_none() && intent != Intent::SeekTo {
            10
        } else {
            secs
        };
        return Some(Detected::new(intent, vec![]).number(secs));
    }

    if c.len() <= 5 && (c.has(RESTART) || c.has(&["начала"])) && !t.found {
        if c.has(&["сначала", "заново", "restart"])
            || (c.has(&["с", "в"]) && c.has(&["начала", "начало"]))
        {
            return Some(Detected::new(Intent::SeekTo, vec![]).number(0));
        }
    }
    None
}
