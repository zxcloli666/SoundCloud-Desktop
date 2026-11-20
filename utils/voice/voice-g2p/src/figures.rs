use crate::en::normalize as english;
use crate::ru::normalize::Normalizer;
use crate::ru::tokens::{Tok, written};

#[derive(Clone, Copy, PartialEq)]
pub enum Tongue {
    Ru,
    En,
}

pub fn in_words(text: &str, usual: Tongue) -> String {
    let (toks, forms): (Vec<Tok>, Vec<String>) = written(text).into_iter().unzip();
    let mut out = String::new();
    let mut prev: Option<String> = None;
    let mut i = 0;
    while i < toks.len() {
        let said = spoken(&toks, &forms, i, prev.as_deref(), usual);
        prev = match &toks[i] {
            Tok::Word(word) => Some(word.to_lowercase()),
            Tok::Space => prev,
            _ => None,
        };
        match said {
            Some((words, used)) => {
                out.push_str(&words);
                i += used;
            }
            None => {
                out.push_str(&forms[i]);
                i += 1;
            }
        }
    }
    out
}

fn spoken(
    toks: &[Tok],
    forms: &[String],
    i: usize,
    prev: Option<&str>,
    usual: Tongue,
) -> Option<(String, usize)> {
    if below_zero(toks, i) {
        let minus = match tongue(toks, i + 1, usual) {
            Tongue::Ru => "минус ",
            Tongue::En => "minus ",
        };
        return Some((minus.to_string(), 1));
    }
    if dotted(toks, i) {
        return None;
    }
    let word = |at: usize| matches!(toks.get(at), Some(Tok::Word(_)));
    let stuck = i > 0 && word(i - 1);
    let (words, used) = match tongue(toks, i, usual) {
        Tongue::Ru if stuck => return None,
        Tongue::Ru => Normalizer::figure(toks, i, prev)?,
        Tongue::En => in_english(toks, &forms[i], i)?,
    };
    let lead = if stuck { " " } else { "" };
    let tail = if word(i + used) { " " } else { "" };
    let words = words.join(" ").replace('+', "");
    Some((format!("{lead}{words}{tail}"), used))
}

fn below_zero(toks: &[Tok], i: usize) -> bool {
    matches!(toks[i], Tok::Sym('-' | '−'))
        && matches!(toks.get(i + 1), Some(Tok::Num(_)))
        && (i == 0 || toks[i - 1] == Tok::Space)
}

fn dotted(toks: &[Tok], i: usize) -> bool {
    let number = |at: usize| matches!(toks.get(at), Some(Tok::Num(_)));
    let dot = |at: usize| toks.get(at) == Some(&Tok::Sym('.'));
    let before = i >= 2 && dot(i - 1) && number(i - 2);
    before || (dot(i + 1) && number(i + 2))
}

fn tongue(toks: &[Tok], i: usize, usual: Tongue) -> Tongue {
    if matches!(&toks[i], Tok::Num(number) if number.suffix.is_some()) {
        return Tongue::Ru;
    }
    let after = toks[i + 1..].iter().find(|tok| **tok != Tok::Space);
    let before = toks[..i]
        .iter()
        .rev()
        .find(|tok| matches!(tok, Tok::Word(_)));
    match (toks[..i].last(), after, before) {
        (Some(Tok::Word(word)), _, _)
        | (_, Some(Tok::Word(word)), _)
        | (_, _, Some(Tok::Word(word))) => of(word),
        _ => usual,
    }
}

fn of(word: &str) -> Tongue {
    if word.chars().any(|c| c.is_ascii_alphabetic()) {
        Tongue::En
    } else {
        Tongue::Ru
    }
}

fn in_english(toks: &[Tok], form: &str, i: usize) -> Option<(Vec<String>, usize)> {
    let (mut words, mut used) = match &toks[i] {
        Tok::Time(hours, minutes) => return Some((english::time_words(*hours, *minutes), 1)),
        Tok::Num(number) => match (toks.get(i + 1), &number.frac) {
            (Some(Tok::Word(suffix)), None) if ordinal(suffix) => {
                (english::number_words(&number.int, None, suffix), 2)
            }
            (Some(Tok::Word(suffix)), None) if suffix == "s" => {
                (several(english::number_words(&number.int, None, "")), 2)
            }
            (_, Some(frac)) if frac.len() == 3 && form.contains(',') => (
                english::number_words(&format!("{}{frac}", number.int), None, ""),
                1,
            ),
            (_, frac) => (english::number_words(&number.int, frac.as_deref(), ""), 1),
        },
        _ => return None,
    };
    let unit = match toks.get(i + used) {
        Some(Tok::Sym('%')) => Some("percent"),
        Some(Tok::Sym('°')) => Some("degrees"),
        _ => None,
    };
    if let Some(unit) = unit {
        words.push(unit.to_string());
        used += 1;
    }
    Some((words, used))
}

fn several(mut words: Vec<String>) -> Vec<String> {
    if let Some(last) = words.pop() {
        words.push(match last.strip_suffix('y') {
            Some(stem) => format!("{stem}ies"),
            None => format!("{last}s"),
        });
    }
    words
}

fn ordinal(suffix: &str) -> bool {
    matches!(
        suffix.to_ascii_lowercase().as_str(),
        "st" | "nd" | "rd" | "th"
    )
}
