use crate::lexicon::{
    ADD_WORDS, ARTIST_MARKERS, GREETINGS, NAME_FORMS, PLAY_STRONG, PLAY_WEAK, PRE,
};
use crate::normalize::{Tok, normalize};
use crate::slots::kind_of;

#[derive(Debug, Default)]
pub struct Names(Vec<Vec<String>>);

impl Names {
    pub fn new<S: AsRef<str>>(names: &[S]) -> Names {
        let mut said: Vec<Vec<String>> = Vec::new();
        for name in names {
            for form in forms(name.as_ref()) {
                if !form.is_empty() && !said.contains(&form) {
                    said.push(form);
                }
            }
        }
        Names(said)
    }

    pub fn in_doubt(&self, text: &str) -> bool {
        self.split(normalize(text).toks).1
    }

    pub(crate) fn drop(&self, toks: Vec<Tok>) -> Vec<Tok> {
        self.split(toks).0
    }

    fn split(&self, toks: Vec<Tok>) -> (Vec<Tok>, bool) {
        let mut kept: Vec<Tok> = Vec::with_capacity(toks.len());
        let mut doubt = false;
        let mut at = 0;
        while at < toks.len() {
            match self.starts(&toks[at..]) {
                Some(len) if !object(&kept) => {
                    at += len;
                    doubt |= !verb_next(&toks[at..]);
                }
                _ => {
                    kept.push(toks[at].clone());
                    at += 1;
                }
            }
        }
        (kept, doubt)
    }

    fn starts(&self, toks: &[Tok]) -> Option<usize> {
        let said = |name: &&Vec<String>| {
            name.len() <= toks.len() && name.iter().zip(toks).all(|(w, t)| *w == t.w)
        };
        self.0.iter().find(said).map(Vec::len)
    }
}

fn forms(name: &str) -> Vec<Vec<String>> {
    let words: Vec<String> = normalize(name).toks.into_iter().map(|t| t.w).collect();
    let cases = match words.as_slice() {
        [word] => NAME_FORMS
            .iter()
            .find(|forms| forms.contains(&word.as_str())),
        _ => None,
    };
    match cases {
        Some(cases) => cases.iter().map(|form| vec![form.to_string()]).collect(),
        None => vec![words],
    }
}

fn object(before: &[Tok]) -> bool {
    let last = before.iter().rev().find(|t| !soft(t));
    last.is_some_and(|t| leads(&t.w))
}

fn verb_next(after: &[Tok]) -> bool {
    let next = after.iter().find(|t| verb(&t.w) || !soft(t));
    next.is_some_and(|t| verb(&t.w))
}

fn soft(t: &&Tok) -> bool {
    PRE.contains(&t.w.as_str()) && !GREETINGS.contains(&t.w.as_str())
}

fn verb(w: &str) -> bool {
    PLAY_STRONG.contains(&w) || PLAY_WEAK.contains(&w) || ADD_WORDS.contains(&w)
}

fn leads(w: &str) -> bool {
    PLAY_STRONG.contains(&w)
        || ADD_WORDS.contains(&w)
        || ARTIST_MARKERS.contains(&w)
        || kind_of(w).is_some()
}
