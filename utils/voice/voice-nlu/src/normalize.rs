use crate::lexicon::{self, DROP_PHRASES, MERGE_PHRASES};
use crate::numbers;

#[derive(Debug, Clone, PartialEq)]
pub struct Tok {
    pub w: String,
    pub amb: bool,
}

#[derive(Debug, Clone)]
pub struct Normalized {
    pub toks: Vec<Tok>,
    pub text: String,
}

pub fn normalize(input: &str) -> Normalized {
    let cleaned = clean(input);
    let mut words: Vec<String> = Vec::new();
    for raw in cleaned.split_whitespace() {
        let fixed = fix_word(raw);
        words.extend(fixed.split_whitespace().map(str::to_string));
    }
    let words = apply_phrases(words);
    let words = numbers::merge(&words, false);
    let toks: Vec<Tok> = words
        .into_iter()
        .filter(|w| !lexicon::has(lexicon::FILLERS, w))
        .map(|w| Tok {
            amb: lexicon::has(lexicon::AMBIGUOUS, &w),
            w,
        })
        .collect();
    let text = toks
        .iter()
        .map(|t| t.w.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    Normalized { toks, text }
}

fn clean(input: &str) -> String {
    let chars: Vec<char> = input
        .to_lowercase()
        .chars()
        .map(|c| if c == 'ё' { 'е' } else { c })
        .collect();
    let mut out = String::with_capacity(chars.len());
    for (i, &c) in chars.iter().enumerate() {
        let prev = if i > 0 { Some(chars[i - 1]) } else { None };
        let next = chars.get(i + 1).copied();
        if c.is_alphanumeric() {
            out.push(c);
        } else if matches!(c, '\'' | '’' | 'ʼ' | '`' | '´') {
        } else if c == ':'
            && prev.is_some_and(|p| p.is_ascii_digit())
            && next.is_some_and(|n| n.is_ascii_digit())
        {
            out.push(':');
        } else if matches!(c, '-' | '–' | '—') {
            let spaced =
                prev.is_none_or(char::is_whitespace) && next.is_none_or(char::is_whitespace);
            out.push_str(if spaced { " - " } else { " " });
        } else if c == '&' {
            out.push_str(" и ");
        } else {
            out.push(' ');
        }
    }
    out
}

fn fix_word(w: &str) -> String {
    if w.chars().any(|c| c.is_ascii_digit()) {
        return w.to_string();
    }
    let c = collapse(w);
    match lexicon::slang(&c) {
        Some(s) => s.to_string(),
        None => c,
    }
}

fn runs(w: &str) -> Vec<(char, usize)> {
    let mut out: Vec<(char, usize)> = Vec::new();
    for c in w.chars() {
        match out.last_mut() {
            Some((p, n)) if *p == c => *n += 1,
            _ => out.push((c, 1)),
        }
    }
    out
}

fn rebuild(runs: &[(char, usize)], cap: impl Fn(usize) -> usize) -> String {
    let mut s = String::new();
    for &(c, n) in runs {
        for _ in 0..cap(n) {
            s.push(c);
        }
    }
    s
}

fn known(w: &str) -> bool {
    lexicon::is_known(w) || lexicon::slang(w).is_some()
}

fn collapse(w: &str) -> String {
    let r = runs(w);
    if r.iter().any(|&(_, n)| n >= 3) {
        let one = rebuild(&r, |_| 1);
        if known(&one) {
            return one;
        }
        let two = rebuild(&r, |n| if n >= 3 { 2 } else { n });
        if known(&two) {
            return two;
        }
        let all = rebuild(&r, |n| if n >= 3 { 1 } else { n });
        let deduped = rebuild(&runs(&all), |_| 1);
        if known(&deduped) {
            return deduped;
        }
        return all;
    }
    if !known(w) && r.iter().any(|&(_, n)| n == 2) {
        let one = rebuild(&r, |_| 1);
        if known(&one) {
            return one;
        }
    }
    w.to_string()
}

fn apply_phrases(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    'outer: while i < words.len() {
        for phrase in DROP_PHRASES {
            if matches_at(&words, i, phrase) {
                i += phrase.len();
                continue 'outer;
            }
        }
        for (phrase, to) in MERGE_PHRASES {
            if matches_at(&words, i, phrase) {
                out.push(to.to_string());
                i += phrase.len();
                continue 'outer;
            }
        }
        out.push(words[i].clone());
        i += 1;
    }
    out
}

fn matches_at(words: &[String], i: usize, phrase: &[&str]) -> bool {
    i + phrase.len() <= words.len() && phrase.iter().zip(&words[i..]).all(|(p, w)| p == w)
}
