use crate::lexicon::{self, GENERIC, PRE, TRANSPORT_VERBS};
use crate::normalize::Tok;
use crate::numbers;
use crate::types::Intent;

#[derive(Debug, Clone)]
pub struct Detected {
    pub intent: Intent,
    pub used: Vec<usize>,
    pub number: Option<u32>,
    pub blocked: bool,
    pub weak: bool,
}

impl Detected {
    pub fn new(intent: Intent, used: Vec<usize>) -> Detected {
        Detected {
            intent,
            used,
            number: None,
            blocked: false,
            weak: false,
        }
    }

    pub fn none() -> Detected {
        Detected::new(Intent::None, Vec::new())
    }

    pub fn blocked() -> Detected {
        Detected {
            blocked: true,
            ..Detected::none()
        }
    }

    pub fn number(mut self, n: u32) -> Detected {
        self.number = Some(n);
        self
    }
}

pub struct Ctx<'a> {
    pub w: Vec<&'a str>,
}

impl<'a> Ctx<'a> {
    pub fn new(toks: &'a [Tok]) -> Ctx<'a> {
        Ctx {
            w: toks.iter().map(|t| t.w.as_str()).collect(),
        }
    }

    pub fn len(&self) -> usize {
        self.w.len()
    }

    pub fn has(&self, list: &[&str]) -> bool {
        self.w.iter().any(|w| list.contains(w))
    }

    pub fn pos(&self, list: &[&str]) -> Option<usize> {
        self.w.iter().position(|w| list.contains(w))
    }

    pub fn all(&self, list: &[&str]) -> Vec<usize> {
        (0..self.w.len())
            .filter(|&i| list.contains(&self.w[i]))
            .collect()
    }

    pub fn has_stem(&self, stems: &[&str]) -> bool {
        self.w.iter().any(|w| lexicon::stem(stems, w))
    }

    pub fn pos_stem(&self, stems: &[&str]) -> Option<usize> {
        self.w.iter().position(|w| lexicon::stem(stems, w))
    }

    pub fn at(&self, i: usize) -> &str {
        self.w.get(i).copied().unwrap_or("")
    }

    pub fn number(&self) -> Option<u32> {
        self.w.iter().find_map(|w| numbers::value(w))
    }

    pub fn stray(&self, used: &[usize]) -> usize {
        (0..self.w.len())
            .filter(|i| !used.contains(i))
            .filter(|&i| {
                let w = self.w[i];
                !PRE.contains(&w) && !GENERIC.contains(&w) && !TRANSPORT_VERBS.contains(&w)
            })
            .count()
    }

    pub fn only_pre(&self, range: std::ops::Range<usize>) -> bool {
        range.into_iter().all(|i| PRE.contains(&self.w[i]))
    }
}
