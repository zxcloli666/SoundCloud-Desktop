use crate::lexicon::{self, NEG_FOLLOW, NEG_STEMS, PLAY_STRONG, REMARK_START};
use crate::normalize::Tok;
use crate::types::Intent;

pub enum Negation {
    Clear,
    Cancel,
    Tail(usize),
}

fn negated_verb(w: &str) -> bool {
    NEG_FOLLOW.contains(&w) || PLAY_STRONG.contains(&w) || lexicon::stem(NEG_STEMS, w)
}

pub fn negation(toks: &[Tok]) -> Negation {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].w != "не" || !negated_verb(&toks[i + 1].w) {
            continue;
        }
        let tail = (i + 2..toks.len()).find(|&j| PLAY_STRONG.contains(&toks[j].w.as_str()));
        return match tail {
            Some(j) => Negation::Tail(j),
            None => Negation::Cancel,
        };
    }
    Negation::Clear
}

fn is_control(i: Intent) -> bool {
    !matches!(
        i,
        Intent::None
            | Intent::Play
            | Intent::QueueAdd
            | Intent::PlaySimilar
            | Intent::PlayWave
            | Intent::PlayLikes
            | Intent::Resume
            | Intent::Help
    )
}

pub fn remark(toks: &[Tok]) -> Option<usize> {
    (1..toks.len().saturating_sub(1))
        .filter(|&k| REMARK_START.contains(&toks[k].w.as_str()))
        .filter(|&k| toks[..k].iter().all(|t| !REMARK_START.contains(&t.w.as_str())))
        .find(|&k| is_control(super::detect(&toks[..k]).intent))
}
