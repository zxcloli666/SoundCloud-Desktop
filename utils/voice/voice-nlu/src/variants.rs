use crate::normalize::Tok;
use crate::slots::Raw;
use crate::types::Variant;

const VOWELS: &str = "аеёиоуыэюя";
const MAX_VARIANTS: usize = 56;
const JOINS: &[&str] = &["и", "and"];

fn ends(w: &str, suffix: &str) -> bool {
    w.ends_with(suffix) && w.chars().count() > suffix.chars().count() + 1
}

fn cut(w: &str, n: usize) -> String {
    let count = w.chars().count();
    w.chars().take(count - n).collect()
}

fn is_vowel(c: char) -> bool {
    VOWELS.contains(c)
}

fn cyrillic(w: &str) -> bool {
    w.chars().any(|c| ('а'..='я').contains(&c))
}

pub fn lemma(w: &str, strategy: u8) -> String {
    if strategy == 0 || !cyrillic(w) {
        return w.to_string();
    }
    let alt = strategy == 2;
    if ends(w, "ого") {
        let stem = cut(w, 3);
        let hard = stem.ends_with(['к', 'г', 'х']);
        return format!("{stem}{}", if hard { "ий" } else { "ый" });
    }
    if ends(w, "его") {
        return format!("{}ий", cut(w, 3));
    }
    if ends(w, "ых") {
        return format!("{}ые", cut(w, 2));
    }
    if ends(w, "их") {
        return format!("{}ие", cut(w, 2));
    }
    if ends(w, "ов") {
        let stem = cut(w, 2);
        return if alt { stem } else { format!("{stem}ы") };
    }
    if ends(w, "ей") {
        return format!("{}и", cut(w, 2));
    }
    if ends(w, "ой") {
        return format!("{}а", cut(w, 2));
    }
    if ends(w, "у") {
        return if alt {
            cut(w, 1)
        } else {
            format!("{}а", cut(w, 1))
        };
    }
    if ends(w, "ю") {
        let stem = cut(w, 1);
        return if alt {
            format!("{stem}ь")
        } else {
            format!("{stem}я")
        };
    }
    if ends(w, "ы") {
        return if alt {
            cut(w, 1)
        } else {
            format!("{}а", cut(w, 1))
        };
    }
    if ends(w, "и") {
        let stem = cut(w, 1);
        let soft = stem.ends_with([
            'к', 'г', 'х', 'ж', 'ч', 'ш', 'щ', 'н', 'р', 'м', 'д', 'т', 'л', 'в', 'з', 'с', 'б',
            'п',
        ]);
        return if alt || !soft {
            format!("{stem}ь")
        } else {
            format!("{stem}а")
        };
    }
    if ends(w, "а") {
        let stem = cut(w, 1);
        return if stem.chars().last().is_some_and(is_vowel) {
            w.to_string()
        } else {
            stem
        };
    }
    if ends(w, "я") {
        let stem = cut(w, 1);
        let last = stem.chars().last().unwrap_or('а');
        let ending = if is_vowel(last) == alt { "ь" } else { "й" };
        return format!("{stem}{ending}");
    }
    w.to_string()
}

const DIMINUTIVES: &[(&str, &str)] = &[
    ("очка", "а"),
    ("ечка", "а"),
    ("ушка", "а"),
    ("юшка", "а"),
    ("онька", "а"),
    ("енька", "а"),
    ("очку", "а"),
    ("ик", ""),
    ("чик", ""),
    ("ок", ""),
];

pub fn shrink(w: &str) -> Option<String> {
    if !cyrillic(w) {
        return None;
    }
    DIMINUTIVES.iter().find_map(|(suffix, back)| {
        let count = w.chars().count();
        let keep = count.checked_sub(suffix.chars().count())?;
        (w.ends_with(suffix) && keep >= 3).then(|| format!("{}{back}", cut(w, count - keep)))
    })
}

fn join_small(toks: &[Tok], strategy: u8) -> String {
    toks.iter()
        .filter(|t| !t.amb)
        .map(|t| {
            let l = lemma(&t.w, strategy);
            shrink(&l).unwrap_or(l)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn join(toks: &[Tok], strategy: u8, keep_amb: bool) -> String {
    toks.iter()
        .filter(|t| keep_amb || !t.amb)
        .map(|t| lemma(&t.w, strategy))
        .collect::<Vec<_>>()
        .join(" ")
}

fn part(toks: &[Tok], strategy: u8) -> String {
    let sure = join(toks, strategy, false);
    if sure.is_empty() {
        join(toks, strategy, true)
    } else {
        sure
    }
}

fn has_amb(toks: &[Tok]) -> bool {
    toks.iter().any(|t| t.amb)
}

fn push(out: &mut Vec<Variant>, v: Variant) {
    if v.text.is_empty() || out.len() >= MAX_VARIANTS || out.contains(&v) {
        return;
    }
    out.push(v);
}

fn plain(text: String, kept: bool, lemmatized: bool) -> Variant {
    Variant {
        text,
        artist: None,
        title: None,
        kept_fillers: kept,
        lemmatized,
        fallback: false,
        alias_kind: None,
    }
}

fn joint(title: String, artist: String, kept: bool, lemmatized: bool) -> Variant {
    Variant {
        text: format!("{title} {artist}"),
        artist: Some(artist),
        title: Some(title),
        kept_fillers: kept,
        lemmatized,
        fallback: false,
        alias_kind: None,
    }
}

const SHORT_NAME: usize = 5;
const LONG_NAME: usize = 7;

fn spans(out: &mut Vec<Variant>, toks: &[Tok]) {
    let toks: Vec<Tok> = toks.iter().filter(|t| !t.amb).cloned().collect();
    let n = toks.len();
    let said = toks
        .iter()
        .filter(|t| !JOINS.contains(&t.w.as_str()))
        .count();
    if n < 2 || !(2..=LONG_NAME).contains(&said) {
        return;
    }
    let long = said > SHORT_NAME;
    for len in 1..=3.min(n - 1) {
        let ends: &[&[Tok]] = if long {
            &[&toks[..len]]
        } else {
            &[&toks[..len], &toks[n - len..]]
        };
        for part in ends.iter().copied() {
            let command = part.iter().any(|t| {
                crate::lexicon::LIKES_PLURAL.contains(&t.w.as_str())
                    || (long && crate::lexicon::is_known(&t.w))
                    || crate::intent::detect(std::slice::from_ref(t)).intent
                        != crate::types::Intent::None
            });
            if command {
                continue;
            }
            for s in 0..3u8 {
                let mut v = plain(join(part, s, false), false, s > 0);
                v.fallback = true;
                push(out, v);
            }
        }
    }
}

pub fn expand(raw: &Raw, with_spans: bool) -> Vec<Variant> {
    let mut out = Vec::new();
    let split = raw.artist.is_some();
    for s in 0..3u8 {
        push(&mut out, plain(join(&raw.plain, s, false), false, s > 0));
    }
    for s in 0..2u8 {
        push(&mut out, plain(join_small(&raw.plain, s), false, true));
    }
    if split {
        let artist = raw.artist.as_deref().unwrap_or(&[]);
        match raw.title.as_deref() {
            Some(title) => {
                for sa in 0..3u8 {
                    for st in 0..2u8 {
                        push(
                            &mut out,
                            joint(part(title, st), part(artist, sa), false, sa > 0 || st > 0),
                        );
                    }
                }
            }
            None => enumerate(&mut out, artist),
        }
        for s in 0..2u8 {
            push(&mut out, plain(join(&raw.full, s, false), false, s > 0));
        }
    } else {
        enumerate(&mut out, &raw.plain);
    }
    if has_amb(&raw.plain) || has_amb(&raw.full) {
        for s in 0..2u8 {
            push(&mut out, plain(join(&raw.full, s, true), true, s > 0));
        }
    }
    if with_spans {
        spans(&mut out, &raw.plain);
    }
    out
}

fn enumerate(out: &mut Vec<Variant>, toks: &[Tok]) {
    let toks: Vec<Tok> = toks.iter().filter(|t| !t.amb).cloned().collect();
    let n = toks.len();
    if !(2..=6).contains(&n) {
        return;
    }
    for k in 1..n {
        let (a, b) = toks.split_at(k);
        push(
            out,
            joint(join(b, 0, false), join(a, 1, false), false, true),
        );
        push(
            out,
            joint(join(a, 0, false), join(b, 1, false), false, true),
        );
    }
}
