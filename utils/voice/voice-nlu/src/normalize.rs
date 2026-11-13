use crate::lexicon::{
    self, CHEERS, COMPLAINT, DEMONSTRATIVES, DROP_PHRASES, MERGE_PHRASES, MUSIC_STEMS, MUTE_WORDS,
    NEXT_STRONG, NEXT_WEAK, PLAY_STRONG, PREV_STRONG, PREV_WEAK, STOP_WORDS, SWEARS_AMB,
};
use crate::numbers;
use crate::repair;
use crate::slots;

#[derive(Debug, Clone, PartialEq)]
pub struct Tok {
    pub w: String,
    pub amb: bool,
}

impl AsRef<str> for Tok {
    fn as_ref(&self) -> &str {
        &self.w
    }
}

#[derive(Debug, Clone)]
pub struct Normalized {
    pub toks: Vec<Tok>,
    pub text: String,
}

pub fn normalize(input: &str) -> Normalized {
    let cleaned = clean(input);
    let mut words: Vec<String> = Vec::new();
    let spoken = repair::context(repair::glue(
        cleaned.split_whitespace().map(str::to_string).collect(),
    ));
    for raw in spoken.iter().map(String::as_str) {
        let fixed = fix_word(raw);
        words.extend(fixed.split_whitespace().map(str::to_string));
    }
    let words = plain(apply_phrases(repair::stutter(repair::glue(words))));
    let words = numbers::out_of_ten(numbers::merge(&numbers::colloquial(words), false));
    let words = drop_swears(dedupe(said_once(without_fillers(words))));
    let toks: Vec<Tok> = words
        .into_iter()
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

pub fn words(input: &str) -> Vec<String> {
    clean(input)
        .split_whitespace()
        .map(str::to_string)
        .collect()
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
    if let Some(s) = lexicon::canon(&c) {
        return s.to_string();
    }
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

fn plain(words: Vec<String>) -> Vec<String> {
    let said_of = words
        .iter()
        .any(|w| DEMONSTRATIVES.contains(&w.as_str()) || lexicon::stem(MUSIC_STEMS, w));
    words
        .into_iter()
        .map(|w| match lexicon::swear(&w) {
            Some(read) if COMPLAINT.contains(&read.as_str()) && !said_of => String::new(),
            Some(read) => read,
            None => w,
        })
        .filter(|w| !w.is_empty())
        .collect()
}

fn without_fillers(words: Vec<String>) -> Vec<String> {
    let filler = |w: &String| lexicon::has(lexicon::FILLERS, w);
    let kept: Vec<bool> = (0..words.len())
        .map(|at| {
            let said = !filler(&words[at])
                || is_the_name(&words, at)
                || is_the_place(&words, at)
                || asks_the_meaning(&words, at);
            said && !like_before_an_order(&words, at) && !introduces_a_name(&words, at)
        })
        .collect();
    let left = words.into_iter().zip(kept).filter(|(_, kept)| *kept);
    left.map(|(word, _)| word).collect()
}

fn introduces_a_name(words: &[String], at: usize) -> bool {
    at > 0 && at + 1 < words.len() && matches!(words[at].as_str(), "called" | "named" | "titled")
}

fn like_before_an_order(words: &[String], at: usize) -> bool {
    let order =
        |w: &String| lexicon::has(PLAY_STRONG, w) || lexicon::has(lexicon::ENGLISH_ORDERS, w);
    words[at] == "like" && words.get(at + 1).is_some_and(order)
}

fn asks_the_meaning(words: &[String], at: usize) -> bool {
    at > 0 && words[at] == lexicon::MEANS && words[at - 1] == "что"
}

fn is_the_place(words: &[String], at: usize) -> bool {
    let stood = at > 0 && words[at - 1] == lexicon::HALT;
    stood && lexicon::has(lexicon::STANDING_PLACES, &words[at])
}

fn is_the_name(words: &[String], at: usize) -> bool {
    let filler = |w: &String| lexicon::has(lexicon::FILLERS, w);
    let after_kind = at > 0 && slots::kind_of(&words[at - 1]).is_some() && !in_a_row(words, at - 1);
    let after_the_verb = at > 0
        && lexicon::has(lexicon::PLAY_STRONG, &words[at - 1])
        && words[..at - 1].iter().all(filler);
    let another_assistant = lexicon::has(lexicon::ASSISTANTS, &words[at]);
    let last = words.get(at + 1).is_none_or(filler);
    let named = after_kind || after_the_verb && another_assistant;
    named && last && !lexicon::has(lexicon::NAMELESS, &words[at])
}

fn in_a_row(words: &[String], kind: usize) -> bool {
    let ordinal = |w: &String| lexicon::stem(NEXT_STRONG, w) || lexicon::stem(PREV_STRONG, w);
    kind > 0 && ordinal(&words[kind - 1])
}

fn matches_at(words: &[String], i: usize, phrase: &[&str]) -> bool {
    i + phrase.len() <= words.len() && phrase.iter().zip(&words[i..]).all(|(p, w)| p == w)
}

pub(crate) fn sung(words: &[String]) -> bool {
    let over_and_over = |n: usize| {
        let mut lines = words.chunks(n);
        let first = lines.next();
        words.len() % n == 0 && lines.all(|line| Some(line) == first)
    };
    (1..=words.len() / 2).any(over_and_over)
}

fn said_once(words: Vec<String>) -> Vec<String> {
    let alpha = |w: &String| w.chars().all(char::is_alphabetic);
    let twice = |at: usize, n: usize| {
        let (first, second) = (at..at + n, at + n..at + 2 * n);
        second.end <= words.len()
            && words[first.clone()] == words[second]
            && words[first].iter().all(alpha)
    };
    let mut out: Vec<String> = Vec::new();
    let mut at = 0;
    while at < words.len() {
        match [3, 2].into_iter().find(|&n| twice(at, n)) {
            Some(n) => at += n,
            None => {
                out.push(words[at].clone());
                at += 1;
            }
        }
    }
    out
}

fn dedupe(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let mut j = i;
        while j < words.len() && words[j] == words[i] {
            j += 1;
        }
        let alpha = words[i].chars().all(char::is_alphabetic) && words[i].chars().count() >= 4;
        let keep = if (j - i == 2 && alpha) || insisted(&words[i]) {
            1
        } else {
            j - i
        };
        out.extend(std::iter::repeat_n(words[i].clone(), keep));
        i = j;
    }
    out
}

fn insisted(w: &str) -> bool {
    let turns = NEXT_WEAK.contains(&w) || PREV_WEAK.contains(&w);
    lexicon::whole_command(w) || (turns && !CHEERS.contains(&w))
}

fn drop_swears(words: Vec<String>) -> Vec<String> {
    let commanded =
        |w: &str| PLAY_STRONG.contains(&w) || STOP_WORDS.contains(&w) || MUTE_WORDS.contains(&w);
    if !words.iter().any(|w| commanded(w)) {
        return words;
    }
    words
        .into_iter()
        .filter(|w| !SWEARS_AMB.contains(&w.as_str()))
        .collect()
}
