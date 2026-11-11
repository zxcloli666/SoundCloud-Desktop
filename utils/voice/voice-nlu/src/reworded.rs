use crate::intent;
use crate::lexicon::{self, BACKWARD, FORWARD, HALF_MINUTE, MIN_UNITS, ONE_AND_HALF, SEC_UNITS};
use crate::normalize::Tok;
use crate::numbers;
use crate::types::Intent;

const BEFORE_AMOUNT: &[&str] = &["на", "до", "в", "к"];
const SCALE_MARKS: &[&str] = &["доля", "ордин"];
const NEXT_TRACK: &str = "дальше";

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
        (false, true) => amount(said, given),
        (true, false) => direction(said, turned),
        (false, false) => direction(&amount(said, given)?, turned),
    }
}

fn amount(said: &[Tok], given: Vec<Tok>) -> Option<Vec<Tok>> {
    let counts = given.iter().filter(|t| count(&t.w)).count();
    let own_unit = given.iter().any(|t| unit(&t.w));
    if counts == 0 && !own_unit {
        return None;
    }
    let first = said.iter().position(|t| measures(&t.w))?;
    let last = said.iter().rposition(|t| measures(&t.w))?;
    let mut out = said.to_vec();
    match said.iter().rposition(|t| count(&t.w)) {
        _ if own_unit || counts > 1 => drop(out.splice(first..=last, given)),
        Some(at) => out[at] = given[0].clone(),
        None => out.insert(first, given[0].clone()),
    }
    Some(out)
}

fn direction(said: &[Tok], turned: Vec<Tok>) -> Option<Vec<Tok>> {
    let rewinds = matches!(
        intent::detect(said).intent,
        Intent::SeekForward | Intent::SeekBackward
    );
    if !rewinds {
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
    (FORWARD.contains(&w) || BACKWARD.contains(&w)) && w != NEXT_TRACK
}
