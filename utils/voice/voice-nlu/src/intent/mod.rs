mod blunt;
mod ctx;
mod guard;
mod indirect;
mod library;
mod play;
mod seek;
mod talk;
mod transport;
mod volume;

use crate::lexicon;
use crate::normalize::Tok;
pub use ctx::{Ctx, Detected};
pub use guard::{Negation, absence, lyric, negation, orders, remark, retold};

pub fn indirect_hit(toks: &[Tok]) -> bool {
    indirect::detect(&Ctx::new(toks)).is_some()
}

pub fn detect(toks: &[Tok]) -> Detected {
    let c = Ctx::new(toks);
    if c.len() == 0 {
        return Detected::none();
    }
    if c.has(lexicon::WATCH) || c.w.iter().any(|w| lexicon::stem(lexicon::DEVICES, w)) {
        return Detected::blocked();
    }
    let next_time =
        c.w.windows(2)
            .any(|p| lexicon::stem(lexicon::NEXT_STRONG, p[0]) && p[1] == "раз");
    let sarcasm = c.has(&["еще"]) && c.has(&["раз"]) && c.has(lexicon::JUNK);
    if next_time || sarcasm || talk::sentence(&c) {
        return Detected::blocked();
    }
    if let Some(d) = indirect::detect(&c) {
        return d;
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
    if let Some(d) = library::into_likes(&c) {
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
        .enumerate()
        .map(
            |(i, t)| match closest(&t.w, toks.get(i + 1).is_some_and(|n| n.w == "бы")) {
                Some(target) => {
                    changed = true;
                    Tok {
                        w: target.to_string(),
                        amb: t.amb,
                    }
                }
                None => t.clone(),
            },
        )
        .collect();
    changed.then_some(fixed)
}

fn closest(w: &str, subjunctive: bool) -> Option<&'static str> {
    let len = w.chars().count();
    let past = !subjunctive && (w.ends_with('л') || w.ends_with("ла") || w.ends_with("ли"));
    if past || len < 5 || lexicon::is_known(w) || w.chars().any(|c| c.is_ascii_digit()) {
        return None;
    }
    let limit = if len >= 8 { 2 } else { 1 };
    let mut best: Option<(&'static str, usize)> = None;
    let targets = lexicon::FUZZY_TARGETS
        .iter()
        .filter(|t| !first_person(w) || first_person(t));
    for &target in targets {
        let d = edit_distance(w, target);
        if d <= limit && best.is_none_or(|(_, b)| d < b) {
            best = Some((target, d));
        }
    }
    best.map(|(t, _)| t)
}

fn first_person(w: &str) -> bool {
    w.ends_with('у') || w.ends_with('ю')
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
