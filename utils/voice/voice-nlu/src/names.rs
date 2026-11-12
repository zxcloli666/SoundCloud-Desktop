use crate::intent;
use crate::lexicon::{
    self, ADD_WORDS, ARTIST_MARKERS, GREETINGS, NAME_FORMS, OBJECT_VERBS, PLAY_STRONG, PLAY_WEAK,
    PRE, REPORT,
};
use crate::normalize::{Tok, normalize};
use crate::slots::kind_of;
use crate::types::Intent;

const GLUED_FROM: usize = 4;

struct Heard {
    kept: Vec<Tok>,
    doubt: bool,
    turned: Option<usize>,
}

#[derive(Debug, Default)]
pub struct Names {
    said: Vec<Vec<String>>,
    called: Vec<Vec<String>>,
}

impl Names {
    pub fn new<S: AsRef<str>>(names: &[S]) -> Names {
        let mut said: Vec<Vec<String>> = Vec::new();
        let mut called: Vec<Vec<String>> = Vec::new();
        for name in names {
            let given = words(name.as_ref());
            for form in forms(&given) {
                if !form.is_empty() && !said.contains(&form) {
                    said.push(form);
                }
            }
            called.push(given);
        }
        Names { said, called }
    }

    pub fn in_doubt(&self, text: &str) -> bool {
        self.split(normalize(text).toks).doubt
    }

    pub(crate) fn drop(&self, toks: Vec<Tok>) -> Vec<Tok> {
        let Heard { kept, turned, .. } = self.split(toks);
        match turned {
            Some(at) if at > 0 && aside(&kept[..at]) => kept[at..].to_vec(),
            _ => kept,
        }
    }

    fn split(&self, toks: Vec<Tok>) -> Heard {
        let toks = self.unglued(toks);
        let mut kept: Vec<Tok> = Vec::with_capacity(toks.len());
        let mut doubt = false;
        let mut turned = None;
        let mut at = 0;
        while at < toks.len() {
            let heard = self.starts(&toks[at..]);
            let told = heard.is_some_and(|len| reported(&toks[at + len..]));
            match heard.filter(|_| !told) {
                Some(len) if !object(&kept) || self.calls(&kept, &toks[at..at + len]) => {
                    at += len;
                    doubt |= !verb_next(&toks[at..]);
                    if ordered(&toks[at..]) {
                        turned = Some(kept.len());
                    }
                }
                _ => {
                    kept.push(toks[at].clone());
                    at += 1;
                }
            }
        }
        Heard {
            kept,
            doubt,
            turned,
        }
    }

    fn unglued(&self, toks: Vec<Tok>) -> Vec<Tok> {
        let mut out = Vec::with_capacity(toks.len());
        for t in toks {
            match self.glued_to(&t.w) {
                Some((name, rest)) => {
                    out.push(Tok {
                        w: name.to_string(),
                        amb: false,
                    });
                    out.push(Tok {
                        w: rest.to_string(),
                        amb: t.amb,
                    });
                }
                None => out.push(t),
            }
        }
        out
    }

    fn glued_to<'a>(&self, w: &'a str) -> Option<(&'a str, &'a str)> {
        self.said.iter().find_map(|name| {
            let [form] = name.as_slice() else {
                return None;
            };
            let rest = w.strip_prefix(form.as_str())?;
            let ordered = rest.chars().count() >= GLUED_FROM && an_order(rest);
            ordered.then(|| w.split_at(form.len()))
        })
    }

    fn starts(&self, toks: &[Tok]) -> Option<usize> {
        self.whole(toks).or_else(|| self.restarted(toks))
    }

    fn whole(&self, toks: &[Tok]) -> Option<usize> {
        let said = |name: &&Vec<String>| {
            name.len() <= toks.len() && name.iter().zip(toks).all(|(w, t)| *w == t.w)
        };
        self.said.iter().find(said).map(Vec::len)
    }

    fn restarted(&self, toks: &[Tok]) -> Option<usize> {
        let (first, rest) = toks.split_first()?;
        let len = self.whole(rest)?;
        let next = rest[0].w.as_str();
        let broken = first.w.chars().count() >= 2
            && next.len() > first.w.len()
            && next.starts_with(first.w.as_str())
            && !lexicon::is_known(&first.w);
        broken.then_some(len + 1)
    }

    fn calls(&self, before: &[Tok], form: &[Tok]) -> bool {
        let given = |name: &Vec<String>| name.iter().eq(form.iter().map(|t| &t.w));
        named_before_verb(before) && self.called.iter().any(given)
    }
}

fn words(name: &str) -> Vec<String> {
    normalize(name).toks.into_iter().map(|t| t.w).collect()
}

fn forms(given: &[String]) -> Vec<Vec<String>> {
    let cases = match given {
        [word] => NAME_FORMS
            .iter()
            .find(|forms| forms.contains(&word.as_str())),
        _ => None,
    };
    match cases {
        Some(cases) => cases.iter().map(|form| vec![form.to_string()]).collect(),
        None => vec![given.to_vec()],
    }
}

fn object(before: &[Tok]) -> bool {
    let last = before.iter().rev().find(|t| !soft(t));
    last.is_some_and(|t| leads(&t.w))
}

fn named_before_verb(before: &[Tok]) -> bool {
    let Some(at) = before.iter().rposition(|t| !soft(&t)) else {
        return false;
    };
    let front = &before[..at];
    let named = front.iter().any(|t| !PRE.contains(&t.w.as_str()));
    commands(&before[at].w) && named && !front.iter().any(|t| commands(&t.w))
}

fn ordered(after: &[Tok]) -> bool {
    let next = after.iter().find(|t| !soft(t));
    next.is_some_and(|t| intent::orders(&t.w) || PLAY_STRONG.contains(&t.w.as_str()))
}

fn reported(after: &[Tok]) -> bool {
    after
        .first()
        .is_some_and(|t| REPORT.contains(&t.w.as_str()))
}

fn aside(before: &[Tok]) -> bool {
    let retold = before.iter().any(|t| REPORT.contains(&t.w.as_str()));
    !retold && intent::detect(before).intent == Intent::None
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
    commands(w) || ARTIST_MARKERS.contains(&w) || kind_of(w).is_some()
}

fn commands(w: &str) -> bool {
    PLAY_STRONG.contains(&w) || ADD_WORDS.contains(&w)
}

fn an_order(w: &str) -> bool {
    let alone = [Tok {
        w: w.to_string(),
        amb: false,
    }];
    let asked = intent::detect(&alone).intent;
    OBJECT_VERBS.contains(&w) || PLAY_STRONG.contains(&w) || asked.is_control()
}
