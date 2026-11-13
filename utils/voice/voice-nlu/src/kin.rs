use crate::intent;
use crate::lexicon::{
    self, CLAUSE_SUBJECTS, KIN, PLAY_STRONG, REPORT, SENT_AWAY, SPEECH, THIRD_PERSON, UP_WORDS,
};
use crate::normalize::Tok;

const REACH: usize = 2;

pub fn kin(w: &str) -> bool {
    KIN.contains(&w)
}

pub fn called<S: AsRef<str>>(words: &[S], at: usize) -> bool {
    kin(words[at].as_ref()) && verb_of(words, at).is_none()
}

pub fn subject<S: AsRef<str>>(words: &[S], at: usize) -> bool {
    kin(words[at].as_ref()) && verb_of(words, at).is_some()
}

pub fn told_of<S: AsRef<str>>(words: &[S], at: usize) -> bool {
    let doer = |who: usize| kin(words[who].as_ref()) && verb_of(words, who) == Some(at);
    (at.saturating_sub(REACH)..at).any(doer)
}

pub fn ordered_to(said: &[Tok], rest: &[Tok]) -> bool {
    let imperative = said.iter().any(|t| intent::orders(&t.w));
    let addressed = intent::hushing(said) || imperative;
    addressed && !rest.is_empty() && called(rest, 0) && !louder_without_them(said, rest)
}

fn louder_without_them(said: &[Tok], rest: &[Tok]) -> bool {
    let louder = matches!(said, [t] if UP_WORDS.contains(&t.w.as_str()));
    louder && rest.iter().any(|t| SENT_AWAY.contains(&t.w.as_str()))
}

fn verb_of<S: AsRef<str>>(words: &[S], who: usize) -> Option<usize> {
    let word = |at: usize| words[at].as_ref();
    let verb = (who + 1..words.len())
        .take(REACH)
        .find(|&at| deed(word(at)))?;
    (who + 1..verb).all(|at| between(word(at))).then_some(verb)
}

fn deed(w: &str) -> bool {
    let speech = lexicon::stem(SPEECH, w) || REPORT.contains(&w);
    THIRD_PERSON.iter().any(|e| w.ends_with(e)) && !lexicon::is_known(w) && !speech
}

fn between(w: &str) -> bool {
    let order = PLAY_STRONG.contains(&w) || lexicon::whole_command(w) || intent::orders(w);
    !kin(w) && !CLAUSE_SUBJECTS.contains(&w) && !order
}
