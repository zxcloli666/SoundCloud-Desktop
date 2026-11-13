use super::unit_secs;
use crate::intent::ctx::Ctx;
use crate::lexicon::PRE;
use crate::numbers;

const JOINED: &[&str] = &["a", "an", "of"];
const LED: &[&str] = &["to", "at", "from"];
const BEGINNING: &[&str] = &["beginning", "top"];
const MARKS: &[&str] = &["mark", "point"];
const MIDDLE: &[&str] = &["middle", "halfway"];
const MOVES: &[&str] = &["go", "skip", "jump", "to"];
const ONCE_MORE: &[&str] = &["over", "again"];
const STARTS: &[&str] = &["start", "play"];

pub fn half(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    if c.at(i) != "half" {
        return None;
    }
    let at = (i + 1..c.len()).find(|&j| !JOINED.contains(&c.w[j]))?;
    Some((unit_secs(c.w[at])? / 2, at + 1))
}

pub fn and_a_half(c: &Ctx, i: usize) -> usize {
    match (c.at(i), c.at(i + 1), c.at(i + 2)) {
        ("and", "a", "half") => 3,
        ("and", "half", _) => 2,
        _ => 0,
    }
}

pub fn position(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    named_minute(c, i).or_else(|| first(c, i))
}

fn named_minute(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    let led = i > 0 && LED.contains(&c.w[i - 1]);
    let minute = numbers::value(c.at(i + 1)).filter(|_| led && c.w[i] == "minute")?;
    unit_secs(c.at(i + 2))
        .is_none()
        .then_some((minute * 60, i + 2))
}

fn first(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    let per = unit_secs(c.at(i + 1)).filter(|_| c.w[i] == "first")?;
    Some((per, i + 2))
}

pub fn several(c: &Ctx, i: usize) -> Option<(u32, usize)> {
    match (c.w[i], c.at(i + 1)) {
        ("few", _) => Some((5, i + 1)),
        ("couple", "of") => Some((2, i + 2)),
        ("couple", _) => Some((2, i + 1)),
        _ => None,
    }
}

pub fn placed(c: &Ctx) -> bool {
    c.has(MARKS) || c.w.last() == Some(&"in")
}

pub fn halfway(c: &Ctx) -> bool {
    c.has(MIDDLE) && c.has(MOVES)
}

pub fn to_the_start(c: &Ctx) -> bool {
    let the_start = c.w.windows(2).any(|p| p == ["the", "start"]);
    ((c.has(BEGINNING) || the_start) && c.has(LED)) || once_more(c)
}

fn once_more(c: &Ctx) -> bool {
    let Some(at) = c.pos(STARTS).filter(|_| c.all(STARTS).len() == 1) else {
        return false;
    };
    let said = c.w.last().is_some_and(|w| ONCE_MORE.contains(w));
    said && c.w[..at].iter().all(|w| PRE.contains(w))
}
