use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::numbers;
use crate::types::Intent;

mod english;

struct Time {
    secs: u32,
    found: bool,
    clock: bool,
    ordinal: bool,
    measured: bool,
    bare: Option<u32>,
}

fn half_after(c: &Ctx, i: usize) -> usize {
    if c.at(i) == "с" && c.at(i + 1) == "половиной" {
        2
    } else {
        english::and_a_half(c, i)
    }
}

fn counted(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    let said = numbers::value(c.w[i]).map(|n| (n, i + 1));
    said.or_else(|| english::several(c, i))
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
        measured: false,
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
            t.measured = true;
            i += 1;
            continue;
        }
        if HALF_MINUTE.contains(&w) {
            t.secs += 30;
            t.found = true;
            t.measured = true;
            i += 1;
            continue;
        }
        if ONE_AND_HALF.contains(&w) {
            if let Some(per) = unit_secs(c.at(i + 1)) {
                t.secs += per * 3 / 2;
                t.found = true;
                t.measured = true;
                i += 2;
                continue;
            }
        }
        let halved = english::half(c, i).map(|said| (said, false));
        let spoken = halved.or_else(|| english::position(c, i).map(|said| (said, true)));
        if let Some(((secs, next), position)) = spoken {
            t.secs += secs;
            t.found = true;
            t.measured = true;
            t.ordinal |= position;
            i = next;
            continue;
        }
        if let Some(per) = unit_secs(w) {
            let single = i > 0 && matches!(c.w[i - 1], "с" | "со");
            let plural =
                !single && matches!(w, "секунд" | "секунды" | "сек" | "минут" | "минуты" | "мин");
            let mut at = i + 1;
            if plural && c.at(at) == "на" {
                at += 1;
            }
            let given = numbers::value(c.at(at)).filter(|_| plural);
            let count = given.unwrap_or(1);
            t.secs += count * per;
            t.found = true;
            if given.is_some() {
                t.measured |= count != 1;
                at += 1;
            } else if per == 60 {
                if let Some(extra) = numbers::value(c.at(at)) {
                    if unit_secs(c.at(at + 1)).is_none() {
                        t.secs += extra;
                        t.clock = true;
                        t.measured = true;
                        at += 1;
                    }
                }
            }
            let half = half_after(c, at);
            if half > 0 {
                t.secs += per / 2;
                t.measured = true;
                at += half;
            }
            i = at;
            continue;
        }
        let Some((count, mut unit_at)) = counted(c, i) else {
            i += 1;
            continue;
        };
        t.measured |= count != 1;
        if let Some(position) = minutes_and_seconds(c, i) {
            t.secs += position;
            t.found = true;
            t.clock = true;
            i += 2;
            continue;
        }
        if c.at(unit_at) == "ордин" {
            t.ordinal = true;
            unit_at += 1;
        }
        let share = c.at(unit_at) == "доля";
        if share {
            unit_at += 1;
        }
        let halves = half_after(c, unit_at);
        unit_at += halves;
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
        if halves > 0 {
            t.secs += per / 2;
            t.measured = true;
        }
        t.found = true;
        i = unit_at + 1;
        let half = half_after(c, i);
        if half > 0 {
            t.secs += per / 2;
            i += half;
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

fn minutes_and_seconds(c: &Ctx, i: usize) -> Option<u32> {
    let led = i > 0 && matches!(c.w[i - 1], "на" | "к" | "с" | "до" | "to" | "at" | "from");
    let mins = numbers::value(c.at(i)).filter(|m| *m < 60)?;
    let secs = numbers::value(c.at(i + 1)).filter(|s| *s < 60)?;
    let unit_next = unit_secs(c.at(i + 2)).is_some() || matches!(c.at(i + 2), "ордин" | "доля");
    (led && !unit_next).then_some(mins * 60 + secs)
}

fn starts_time(w: &str) -> bool {
    numbers::is_number(w)
        || numbers::clock(w).is_some()
        || unit_secs(w).is_some()
        || HALF_MINUTE.contains(&w)
        || ONE_AND_HALF.contains(&w)
}

fn since(c: &Ctx) -> bool {
    c.w.windows(2)
        .any(|p| matches!(p[0], "с" | "со" | "from") && starts_time(p[1]))
}

fn from_start(c: &Ctx) -> bool {
    let apart =
        c.w.windows(2)
            .any(|p| matches!(p[0], "от" | "с") && matches!(p[1], "начала" | "начало"));
    apart || (c.len() > 1 && c.w.last() == Some(&"сначала"))
}

fn vocabulary(w: &str) -> bool {
    numbers::is_number(w)
        || numbers::clock(w).is_some()
        || SEEK_FILL.contains(&w)
        || SEEK_FILL_EN.contains(&w)
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
        || START.contains(&w)
        || stem(&["перемот", "промот", "отмот"], w)
}

pub fn restarts(c: &Ctx) -> bool {
    let named = c.has(FROM_THE_TOP) || c.has(START) || played_again(c);
    named && !foreign(c) && !time(c).found
}

fn played_again(c: &Ctx) -> bool {
    let once_more = c.w.windows(2).any(|p| p == ["еще", "раз"]);
    (once_more && c.has(PLAY_STRONG)) || english::to_the_start(c)
}

fn foreign(c: &Ctx) -> bool {
    !c.w.iter().all(|w| vocabulary(w))
}

fn lasting(w: &str) -> bool {
    starts_time(w) || matches!(w, "на" | "с" | "половиной")
}

pub fn wait(c: &Ctx) -> Vec<usize> {
    let mut said = Vec::new();
    if c.has(FORWARD) || c.has(BACKWARD) {
        return said;
    }
    let opens = |j: usize| c.w[j] == "на" && unit_secs(c.w[j - 1]).is_none();
    let mut i = 0;
    while i < c.len() {
        if !lasting(c.w[i]) {
            i += 1;
            continue;
        }
        let end = (i + 1..c.len())
            .find(|&j| !lasting(c.w[j]) || opens(j))
            .unwrap_or(c.len());
        let span = Ctx {
            w: c.w[i..end].to_vec(),
        };
        if span.has(&["на"]) && time(&span).found {
            said.extend(i..end);
        }
        i = end;
    }
    said
}

pub fn hedges(c: &Ctx) -> Vec<usize> {
    let hedge = |i: usize| {
        ROUGHLY.contains(&c.w[i])
            || (c.w[i] == "где" && c.at(i + 1) == "то")
            || (c.w[i] == "то" && i > 0 && c.w[i - 1] == "где")
    };
    (0..c.len()).filter(|&i| hedge(i)).collect()
}

fn unhedged<'a>(c: &Ctx<'a>) -> Ctx<'a> {
    let skipped = hedges(c);
    let kept = (0..c.len()).filter(|i| !skipped.contains(i));
    Ctx {
        w: kept.map(|i| c.w[i]).collect(),
    }
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    let plain = unhedged(c);
    let t = time(&plain);
    let c = if t.found || t.bare.is_some() {
        &plain
    } else {
        c
    };
    if c.len() > 10 || foreign(c) {
        return None;
    }
    let fwd = c.has(FORWARD);
    let back = c.has(BACKWARD);
    let seek_verb = c.has(SEEK_VERBS) || c.has_stem(&["перемот", "промот", "отмот"]);
    let to_place = c.has(&["to"]) && c.has(&["go", "skip", "jump"]);
    let jump_verb = c.has(JUMP_VERBS) || to_place;
    let set_verb = c.has(SET_VERBS) && t.found;
    let skip_verb = c.has(SKIP_VERBS);
    let plus = c.has(&["плюс"]);
    let minus = c.has(&["минус"]);
    let back_verb =
        c.has(BACK_VERBS) || c.has_stem(&["отмот"]) || c.has(&["вернись", "вернуться"]) || minus;
    let on_time = c.at(0) == "на" && t.found && t.measured && !fwd && !back && !plus && !minus;
    let explicit_dir = back || (fwd && c.at(0) != "дальше");
    let has_dir = explicit_dir || (fwd && t.found);
    let amount = t.found || t.bare.is_some();
    let from = !back && t.found && since(c);
    let marked = t.found && english::placed(c);
    let placed = from || marked || (!back && amount && from_start(c));
    let nudged = explicit_dir && (c.has(SLIGHTLY) || c.has(JUMP_VERBS));

    let triggered = if amount {
        seek_verb
            || jump_verb
            || set_verb
            || (t.ordinal && t.found)
            || (explicit_dir && t.bare.is_some())
            || ((skip_verb || has_dir || plus || minus) && t.found)
            || (back_verb && t.found)
            || (from && c.has(PLAY_STRONG))
            || on_time
            || marked
    } else {
        (seek_verb && c.len() <= 4) || nudged
    };

    let middle = c.has_stem(&["середин"]) && (seek_verb || c.at(0) == "на") && c.len() <= 6;
    if middle || english::halfway(c) {
        return Some(Detected::new(Intent::SeekTo, vec![]).fraction(0.5));
    }

    let mut turned = c.all(SEEK_VERBS);
    turned.extend(c.all(&["самого"]));
    let to_start =
        c.len() <= 6 && !t.found && (c.has(FROM_THE_TOP) || c.has(START)) && c.stray(&turned) <= 2;
    if (to_start && !fwd) || (!amount && played_again(c)) {
        return Some(Detected::new(Intent::SeekTo, vec![]).number(0));
    }
    if to_place && !amount && c.has(&["end"]) {
        return Some(Detected::new(Intent::Next, vec![]));
    }

    if triggered {
        let secs = if t.found {
            t.secs
        } else {
            t.bare.unwrap_or(10)
        };
        let to_zero = !t.found && t.bare == Some(0);
        let jumped = to_place || (jump_verb && !explicit_dir);
        let absolute = t.ordinal || jumped || set_verb || on_time || placed || to_zero;
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
        if c.has(FROM_THE_TOP) || (c.has(&["с", "в"]) && c.has(&["начала", "начало"]))
        {
            return Some(Detected::new(Intent::SeekTo, vec![]).number(0));
        }
    }
    None
}
