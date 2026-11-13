use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

const ANNOUNCED: &[&str] = &["продолжение", "продолжим", "продолжаем"];

const THAT_ONE: &str = "1";

fn base(c: &Ctx, i: usize) -> Vec<usize> {
    let mut used = vec![i];
    if c.at(i + 1) == THAT_ONE {
        used.push(i + 1);
    }
    used.extend((0..c.len()).filter(|&j| {
        PLAY_STRONG.contains(&c.w[j])
            || matches!(
                c.w[j],
                "верни" | "вернуть" | "верну" | "вернись" | "вернуться" | "переключи"
            )
    }));
    used
}

fn held(c: &Ctx, i: usize) -> Vec<usize> {
    let mut used = base(c, i);
    used.extend(super::seek::wait(c));
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
    if c.w == [HALT] {
        return Some(Detected::new(Intent::Stop, vec![0]));
    }
    if let (Some(lift), Some(pause)) = (c.pos(PAUSE_LIFTING), c.pos_stem(&["пауз"])) {
        if c.stray(&[lift, pause]) == 0 {
            return Some(Detected::new(Intent::Resume, vec![]));
        }
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
        let mut said = base(c, i);
        said.extend(c.all(&["back", "to"]));
        if c.stray(&said) == 0 {
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
        if only_for_a_while(c, &held(c, i)) {
            return Some(Detected::new(Intent::Pause, vec![i]));
        }
    }
    if let Some(i) = c.pos_stem(&["стоп", "stop"]).or_else(|| c.pos(STOP_WORDS)) {
        let mut said = held(c, i);
        said.extend(c.all(STOP_WORDS));
        if only_for_a_while(c, &said) {
            return Some(Detected::new(Intent::Stop, vec![i]));
        }
    }
    if plays_on(c) {
        return Some(Detected::new(Intent::Resume, vec![]));
    }
    if let Some(i) = c.pos(RESUME_WORDS) {
        let strays = c.stray_words(&base(c, i));
        let told = strays.iter().any(|w| !crate::lexicon::is_known(w));
        let announced = ANNOUNCED.contains(&c.w[i]) && told;
        if !announced
            && strays.len() <= 1
            && !strays
                .iter()
                .any(|w| w.ends_with('й') || w.ends_with("йте"))
        {
            return Some(Detected::new(Intent::Resume, vec![i]));
        }
    }
    if let Some(i) = c.pos(NEXT_WEAK) {
        let mut said = base(c, i);
        said.extend(c.all(FORWARD));
        if c.stray(&said) == 0 {
            return Some(Detected::new(Intent::Next, vec![i]));
        }
    }
    if let Some(i) = c
        .pos(PREV_WEAK)
        .filter(|&i| !(c.w[i] == "обратно" && c.has(PLAY_STRONG)))
    {
        let mut said = base(c, i);
        said.extend(c.all(SKIP_VERBS));
        if c.stray(&said) == 0 {
            return Some(Detected::new(Intent::Previous, vec![i]));
        }
    }
    None
}

fn only_for_a_while(c: &Ctx, said: &[usize]) -> bool {
    let heading = c.has(FORWARD) || c.has(BACKWARD);
    c.stray_words(said).iter().all(|w| {
        !heading
            && (A_WHILE.contains(w)
                || SEC_UNITS.contains(w)
                || MIN_UNITS.contains(w)
                || crate::numbers::is_number(w))
    })
}

fn plays_on(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        PLAYING_ON.contains(&c.w[i - 1]) && c.w[i] == "дальше" && c.stray(&[i - 1, i]) == 0
    })
}
