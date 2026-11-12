use crate::intent;
use crate::lexicon::{
    self, BACKWARD, FORWARD, HALF_MINUTE, HIGHER, LOWER, MIN_UNITS, ONE_AND_HALF, SEC_UNITS,
};
use crate::normalize::Tok;
use crate::numbers;
use crate::types::Intent;

const BEFORE_AMOUNT: &[&str] = &["на", "до", "в", "к"];
const SCALE_MARKS: &[&str] = &["доля", "ордин"];
const NEXT_TRACK: &str = "дальше";
const LOUDNESS_TURNS: &[&str] = &["up", "down"];
const TENTHS: std::ops::RangeInclusive<u32> = 1..=10;
const PERCENT: &str = "процентов";

enum Place {
    Said(usize),
    Implied(usize),
}

pub fn part(said: &[Tok], again: &[Tok]) -> Option<Vec<Tok>> {
    let known = |t: &Tok| {
        let w = t.w.as_str();
        measures(w) || turns(w) || BEFORE_AMOUNT.contains(&w)
    };
    if !again.iter().all(known) {
        return None;
    }
    let given: Vec<Tok> = again.iter().filter(|t| measures(&t.w)).cloned().collect();
    let turned: Vec<Tok> = again.iter().filter(|t| turns(&t.w)).cloned().collect();
    match (given.is_empty(), turned.is_empty()) {
        (true, true) => None,
        (false, true) => amount(said, given).map(|sized| on_the_same_scale(said, sized)),
        (true, false) => direction(said, turned),
        (false, false) => direction(&amount(said, given)?, turned),
    }
}

fn on_the_same_scale(said: &[Tok], mut sized: Vec<Tok>) -> Vec<Tok> {
    let tenth = |t: &Tok| numbers::value(&t.w).is_some_and(|n| TENTHS.contains(&n));
    let number = |toks: &[Tok]| toks.iter().rposition(|t| numbers::is_number(&t.w));
    let sets = intent::detect(said).intent == Intent::VolumeSet;
    let named = sized.iter().any(|t| unit(&t.w));
    if let (true, false, Some(was), Some(now)) = (sets, named, number(said), number(&sized)) {
        if !tenth(&said[was]) && tenth(&sized[now]) {
            let percent = Tok {
                w: PERCENT.into(),
                amb: false,
            };
            sized.insert(now + 1, percent);
        }
    }
    sized
}

fn amount(said: &[Tok], given: Vec<Tok>) -> Option<Vec<Tok>> {
    let own_unit = given.iter().any(|t| unit(&t.w));
    let first = said.iter().position(|t| measures(&t.w))?;
    let last = said.iter().rposition(|t| measures(&t.w))?;
    let mut out = said.to_vec();
    if own_unit {
        out.splice(first..=last, given);
        return Some(out);
    }
    let counts: Vec<Tok> = given.into_iter().filter(|t| count(&t.w)).collect();
    let places = places(said);
    let filled = match counts.len() {
        0 => return None,
        said_all if said_all == places.len() => places.as_slice(),
        1 => std::slice::from_ref(places.last()?),
        _ => {
            out.splice(first..=last, counts);
            return Some(out);
        }
    };
    for (place, number) in filled.iter().zip(counts).rev() {
        match *place {
            Place::Said(at) => out[at] = number,
            Place::Implied(at) => out.insert(at, number),
        }
    }
    Some(out)
}

fn places(said: &[Tok]) -> Vec<Place> {
    let mut out = Vec::new();
    for (at, t) in said.iter().enumerate() {
        let counted = at > 0 && count(&said[at - 1].w);
        if count(&t.w) {
            out.push(Place::Said(at));
        } else if unit(&t.w) && !counted {
            out.push(Place::Implied(at));
        }
    }
    out
}

fn direction(said: &[Tok], turned: Vec<Tok>) -> Option<Vec<Tok>> {
    let steps = matches!(
        intent::detect(said).intent,
        Intent::SeekForward | Intent::SeekBackward | Intent::VolumeUp | Intent::VolumeDown
    );
    if !steps {
        return None;
    }
    let mut out: Vec<Tok> = said.iter().filter(|t| !turns(&t.w)).cloned().collect();
    out.extend(turned);
    Some(out)
}

fn measures(w: &str) -> bool {
    count(w) || unit(w) || SCALE_MARKS.contains(&w)
}

fn count(w: &str) -> bool {
    numbers::is_number(w)
        || numbers::clock(w).is_some()
        || HALF_MINUTE.contains(&w)
        || ONE_AND_HALF.contains(&w)
}

fn unit(w: &str) -> bool {
    SEC_UNITS.contains(&w)
        || MIN_UNITS.contains(&w)
        || HALF_MINUTE.contains(&w)
        || lexicon::stem(&["процент"], w)
}

fn turns(w: &str) -> bool {
    let loudness = LOUDNESS_TURNS.contains(&w) || HIGHER.contains(&w) || LOWER.contains(&w);
    let heading = FORWARD.contains(&w) || BACKWARD.contains(&w) || loudness;
    heading && w != NEXT_TRACK
}
