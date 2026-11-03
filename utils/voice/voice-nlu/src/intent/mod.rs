mod ctx;
mod guard;
mod library;
mod play;
mod seek;
mod transport;
mod volume;

use crate::lexicon;
use crate::normalize::Tok;
pub use ctx::{Ctx, Detected};
pub use guard::{Negation, negation, remark};

pub fn detect(toks: &[Tok]) -> Detected {
    let c = Ctx::new(toks);
    if c.len() == 0 {
        return Detected::none();
    }
    if let Some(d) = library::undo(&c) {
        return d;
    }
    if let Some(d) = library::help(&c) {
        return d;
    }
    if let Some(d) = library::queue(&c) {
        return d;
    }
    if play::forced(&c) {
        return play::detect(&c, true);
    }
    if let Some(d) = volume::detect(&c) {
        return d;
    }
    if let Some(d) = seek::detect(&c) {
        return d;
    }
    if let Some(d) = play::content(&c) {
        return d;
    }
    if let Some(d) = library::like(&c) {
        return d;
    }
    if let Some(d) = library::shuffle(&c) {
        return d;
    }
    if let Some(d) = library::repeat(&c) {
        return d;
    }
    if let Some(d) = library::now_playing(&c) {
        return d;
    }
    if let Some(d) = transport::detect(&c) {
        return d;
    }
    play::detect(&c, false)
}

pub fn fuzzy_fix(toks: &[Tok]) -> Option<Vec<Tok>> {
    let mut changed = false;
    let fixed: Vec<Tok> = toks
        .iter()
        .map(|t| match closest(&t.w) {
            Some(target) => {
                changed = true;
                Tok {
                    w: target.to_string(),
                    amb: t.amb,
                }
            }
            None => t.clone(),
        })
        .collect();
    changed.then_some(fixed)
}

fn closest(w: &str) -> Option<&'static str> {
    let len = w.chars().count();
    if len < 4 || lexicon::is_known(w) || w.chars().any(|c| c.is_ascii_digit()) {
        return None;
    }
    let limit = if len >= 8 { 2 } else { 1 };
    let mut best: Option<(&'static str, usize)> = None;
    for &target in lexicon::FUZZY_TARGETS {
        let d = edit_distance(w, target);
        if d <= limit && best.is_none_or(|(_, b)| d < b) {
            best = Some((target, d));
        }
    }
    best.map(|(t, _)| t)
}

pub fn edit_distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for i in 1..=a.len() {
        let mut cur = vec![i];
        for j in 1..=b.len() {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            cur.push((prev[j] + 1).min(cur[j - 1] + 1).min(prev[j - 1] + cost));
        }
        prev = cur;
    }
    prev[b.len()]
}
