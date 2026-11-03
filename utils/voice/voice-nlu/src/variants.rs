use crate::normalize::Tok;
use crate::slots::Raw;
use crate::types::Variant;

const VOWELS: &str = "аеёиоуыэюя";
const MAX_VARIANTS: usize = 40;

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

fn join(toks: &[Tok], strategy: u8, keep_amb: bool) -> String {
    toks.iter()
        .filter(|t| keep_amb || !t.amb)
        .map(|t| lemma(&t.w, strategy))
        .collect::<Vec<_>>()
        .join(" ")
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
    }
}

fn joint(title: String, artist: String, kept: bool, lemmatized: bool) -> Variant {
    Variant {
        text: format!("{title} {artist}"),
        artist: Some(artist),
        title: Some(title),
        kept_fillers: kept,
        lemmatized,
    }
}

pub fn expand(raw: &Raw) -> Vec<Variant> {
    let mut out = Vec::new();
    let split = raw.artist.is_some();
    for s in 0..3u8 {
        push(&mut out, plain(join(&raw.plain, s, false), false, s > 0));
    }
    if split {
        let artist = raw.artist.as_deref().unwrap_or(&[]);
        match raw.title.as_deref() {
            Some(title) => {
                for sa in 0..3u8 {
                    for st in 0..2u8 {
                        push(
                            &mut out,
                            joint(
                                join(title, st, false),
                                join(artist, sa, false),
                                false,
                                sa > 0 || st > 0,
                            ),
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
