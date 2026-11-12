use super::ctx::Ctx;
use super::indirect;
use super::talk;
use crate::lexicon::{
    self, ABOUT_OWN_WORDS, ADDRESSEES, AFTER_ABSENT, BACKWARD, BEFORE_ABSENT, DENY, DOWN_WORDS,
    ENDEARMENTS, FORWARD, IMPERATIVES, LONE_VERBS, NEG_FOLLOW, NEG_STEMS, OBJECT_VERBS,
    PLAY_STRONG, REMARK_START, REPORT, SUBJECTS, UP_WORDS,
};
use crate::normalize::Tok;
use crate::types::Intent;

pub enum Negation {
    Clear,
    Cancel,
    Tail(usize),
}

fn negated_verb(w: &str) -> bool {
    let heading = FORWARD.contains(&w) || BACKWARD.contains(&w);
    heading || NEG_FOLLOW.contains(&w) || PLAY_STRONG.contains(&w) || lexicon::stem(NEG_STEMS, w)
}

pub fn lyric(toks: &[Tok]) -> bool {
    chanted(toks) || talk::marching(&Ctx::new(toks))
}

fn chanted(toks: &[Tok]) -> bool {
    let half = toks.len() / 2;
    if toks.len() >= 4 && toks.len() % 2 == 0 && toks[..half] == toks[half..] {
        return true;
    }
    toks.windows(3).any(|w| {
        w[0].w == w[1].w
            && w[1].w == w[2].w
            && w[0].w.chars().count() >= 4
            && !PLAY_STRONG.contains(&w[0].w.as_str())
    })
}

pub fn retold(toks: &[Tok]) -> bool {
    let c = Ctx::new(toks);
    let speech = |i: usize| {
        let w = c.w[i];
        REPORT.contains(&w) && !ADDRESSEES.contains(&w) && !own_words(&c.w[..i], &c.w[i + 1..])
    };
    (0..c.len()).any(speech) || (1..c.len()).any(|i| c.w[i] == "нет" && answered(&c.w[..i]))
}

fn own_words(before: &[&str], after: &[&str]) -> bool {
    let by_the_speaker = match before {
        [.., "я"] => true,
        [.., "я", between] => ABOUT_OWN_WORDS.contains(between),
        _ => false,
    };
    by_the_speaker && after.first().is_none_or(|w| matches!(*w, "не" | "нет"))
}

fn answered(before: &[&str]) -> bool {
    match before {
        [.., who, whom] if ADDRESSEES.contains(whom) => SUBJECTS.contains(who),
        [.., who] => SUBJECTS.contains(who),
        [] => false,
    }
}

pub fn negation(toks: &[Tok]) -> Negation {
    if lyric(toks) {
        return Negation::Cancel;
    }
    if toks.len() >= 2 && toks[0].w == "не" && toks[1].w == "не" {
        return Negation::Cancel;
    }
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].w != "не" || !negated_verb(&toks[i + 1].w) {
            continue;
        }
        let ordered = |j: usize| orders(&toks[j].w) && toks[j - 1].w != "не";
        let tail = (i + 2..toks.len()).find(|&j| ordered(j));
        return match tail {
            Some(j) => Negation::Tail(j),
            None => Negation::Cancel,
        };
    }
    Negation::Clear
}

pub fn orders(w: &str) -> bool {
    IMPERATIVES.contains(&w) || (LONE_VERBS.contains(&w) && !w.ends_with("ть"))
}

pub fn remark(toks: &[Tok]) -> Option<usize> {
    if talk::sentence(&Ctx::new(toks)) {
        return None;
    }
    restated(toks)
        .or_else(|| started(toks))
        .or_else(|| reasoned(toks))
}

fn restated(toks: &[Tok]) -> Option<usize> {
    (1..toks.len().saturating_sub(1)).find(|&k| cuttable(toks, k) && same_ask(toks, k))
}

fn same_ask(toks: &[Tok], k: usize) -> bool {
    let said = super::detect(&toks[..k]).intent;
    indirect::detect(&Ctx::new(&toks[k..])).is_some_and(|state| state.intent == said)
}

fn started(toks: &[Tok]) -> Option<usize> {
    let opens = |k: usize| {
        let inside = k + 1 < toks.len();
        let remark = REMARK_START.contains(&toks[k].w.as_str()) && inside && !listener(toks, k);
        remark || addressed(toks, k)
    };
    (1..toks.len())
        .filter(|&k| opens(k))
        .filter(|&k| {
            toks[..k]
                .iter()
                .all(|t| !REMARK_START.contains(&t.w.as_str()))
        })
        .find(|&k| cuttable(toks, k))
}

fn addressed(toks: &[Tok], k: usize) -> bool {
    let hushing = matches!(&toks[..k], [t] if UP_WORDS.contains(&t.w.as_str()) || DOWN_WORDS.contains(&t.w.as_str()));
    let commanded = super::detect(&toks[..k]).intent.is_control();
    ENDEARMENTS.contains(&toks[k].w.as_str()) && commanded && !hushing
}

fn listener(toks: &[Tok], k: usize) -> bool {
    let verb = toks[k - 1].w.as_str();
    let commanded = PLAY_STRONG.contains(&verb) || OBJECT_VERBS.contains(&verb);
    matches!(toks[k].w.as_str(), "мне" | "нам") && commanded
}

fn reasoned(toks: &[Tok]) -> Option<usize> {
    if super::detect(toks).blocked {
        return None;
    }
    (2..toks.len().saturating_sub(1))
        .find(|&k| full_command(&toks[..k]) && cuttable(toks, k) && states_absence(&toks[k..]))
}

fn full_command(said: &[Tok]) -> bool {
    let verb = |t: &Tok| LONE_VERBS.contains(&t.w.as_str()) || PLAY_STRONG.contains(&t.w.as_str());
    let names_music = super::detect(said).intent.needs_entity();
    said.iter().any(verb) && !said.last().is_some_and(verb) && !names_music
}

fn states_absence(after: &[Tok]) -> bool {
    let words: Vec<&str> = after.iter().map(|t| t.w.as_str()).collect();
    (1..words.len()).any(|at| absence(&words, at)) && !words.iter().any(|w| DENY.contains(w))
}

pub fn absence<S: AsRef<str>>(words: &[S], at: usize) -> bool {
    let near = |i: Option<usize>, list: &[&str]| {
        i.and_then(|i| words.get(i))
            .is_some_and(|w| list.contains(&w.as_ref()))
    };
    words[at].as_ref() == "нет"
        && (near(at.checked_sub(1), BEFORE_ABSENT) || near(Some(at + 1), AFTER_ABSENT))
}

fn cuttable(toks: &[Tok], k: usize) -> bool {
    match super::detect(&toks[..k]).intent {
        Intent::None
        | Intent::Help
        | Intent::Undo
        | Intent::PlaySimilar
        | Intent::PlayWave
        | Intent::PlayLikes => false,
        Intent::Resume => false,
        Intent::Play | Intent::QueueAdd => k >= 2,
        _ => true,
    }
}
