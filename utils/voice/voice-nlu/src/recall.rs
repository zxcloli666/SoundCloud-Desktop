use crate::lexicon::{IMPERATIVES, INTRODUCES, NAMING, POINTS_BACK, REPORT};
use crate::normalize::Tok;
use crate::slots::kind_of;

pub fn named(toks: Vec<Tok>) -> Vec<Tok> {
    let Some((talk, verb)) = pointer(&toks) else {
        return toks;
    };
    let Some(name) = recalled(&toks[..talk]) else {
        return toks;
    };
    let mut asked = vec![toks[verb].clone()];
    asked.extend_from_slice(name);
    asked
}

fn pointer(toks: &[Tok]) -> Option<(usize, usize)> {
    let word = |i: usize| toks.get(i).map_or("", |t| t.w.as_str());
    let n = toks.len();
    if n < 3 {
        return None;
    }
    if IMPERATIVES.contains(&word(n - 2)) && POINTS_BACK.contains(&word(n - 1)) {
        return Some((n - 2, n - 2));
    }
    let joined = usize::from(word(n - 2) == "и");
    let at = n.checked_sub(2 + joined)?;
    let pointed = IMPERATIVES.contains(&word(n - 1)) && POINTS_BACK.contains(&word(at));
    let shown = usize::from(at > 0 && word(at - 1) == "вот");
    pointed.then_some((at - shown, n - 1))
}

fn recalled(talk: &[Tok]) -> Option<&[Tok]> {
    let kind = |t: &Tok| kind_of(&t.w).is_some();
    let introduces = |t: &Tok| INTRODUCES.contains(&t.w.as_str()) || kind(t);
    if talk.iter().any(|t| REPORT.contains(&t.w.as_str())) {
        return None;
    }
    let last = talk.iter().rposition(introduces)?;
    let kinds = talk[..=last].iter().rev().take_while(|t| kind(t)).count();
    let naming = |t: &&Tok| NAMING.contains(&t.w.as_str());
    let end = talk.len() - talk.iter().rev().take_while(naming).count();
    (end > last + 1).then(|| &talk[last + 1 - kinds..end])
}
