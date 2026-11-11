use crate::intent;
use crate::lexicon::{self, BACKWARD, FORWARD, HALF_MINUTE, MIN_UNITS, ONE_AND_HALF, SEC_UNITS};
use crate::normalize::Tok;
use crate::numbers;
use crate::types::Intent;

const BEFORE_AMOUNT: &[&str] = &["на", "до", "в", "к"];
const SCALE_MARKS: &[&str] = &["доля", "ордин"];
const NEXT_TRACK: &str = "дальше";

pub fn amount(said: &[Tok], again: &[Tok]) -> Option<Vec<Tok>> {
    let only_amount = again
        .iter()
        .all(|t| measures(&t.w) || BEFORE_AMOUNT.contains(&t.w.as_str()));
    let given: Vec<Tok> = again.iter().filter(|t| measures(&t.w)).cloned().collect();
    let counts = given.iter().filter(|t| count(&t.w)).count();
    let own_unit = given.iter().any(|t| unit(&t.w));
    if !only_amount || (counts == 0 && !own_unit) {
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

pub fn direction(said: &[Tok], again: &[Tok]) -> Option<Vec<Tok>> {
    let rewinds = matches!(
        intent::detect(said).intent,
        Intent::SeekForward | Intent::SeekBackward
    );
    if !rewinds || !again.iter().all(|t| turns(&t.w)) {
        return None;
    }
    let mut out: Vec<Tok> = said.iter().filter(|t| !turns(&t.w)).cloned().collect();
    out.extend(again.iter().cloned());
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
