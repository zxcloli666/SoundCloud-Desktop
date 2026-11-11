use crate::intent;
use crate::lexicon::CORRECTION_NOISE;
use crate::normalize::{Tok, normalize, words};
use crate::numbers;
use crate::reworded;

const REPLACE: &[&[&str]] = &[
    &["или", "нет"],
    &["а", "нет"],
    &["ой", "нет"],
    &["то", "есть"],
    &["в", "смысле"],
    &["тьфу", "ты"],
    &["вернее"],
    &["точнее"],
    &["хотя"],
    &["тьфу"],
    &["ой"],
    &["нет"],
];

const AT_LEAST: &[&str] = &["хотя", "бы"];
const RESTART: &str = "давай";

const NEGATING: &[&[&str]] = &[&["а", "не"], &["только", "не"], &["но", "не"], &["и", "не"]];

fn starts(ws: &[String], at: usize, marker: &[&str]) -> bool {
    at + marker.len() <= ws.len() && marker.iter().zip(&ws[at..]).all(|(m, w)| m == w)
}

fn skip_noise(ws: &[String], mut at: usize) -> usize {
    while at + 1 < ws.len() && noise(&ws[at]) {
        at += 1;
    }
    at
}

fn noise(w: &str) -> bool {
    CORRECTION_NOISE.contains(&w)
}

fn toks(ws: &[String]) -> Vec<Tok> {
    normalize(&ws.join(" ")).toks
}

#[derive(Default)]
struct Version {
    words: Vec<String>,
    marked: bool,
}

pub fn resolve(text: &str) -> Option<Vec<Tok>> {
    let versions = versions(&words(text))?;
    Some(versions.into_iter().fold(Vec::new(), merge))
}

fn versions(ws: &[String]) -> Option<Vec<Version>> {
    let mut said: Vec<Version> = Vec::new();
    let mut cur = Version::default();
    let mut dropping = false;
    let mut found = false;
    let mut i = 0;
    while i < ws.len() {
        if let Some(len) = rejected(ws, i) {
            found = true;
            dropping = true;
            i += len;
        } else if let Some(end) = marker(ws, i) {
            found = true;
            dropping = false;
            let next = Version {
                words: Vec::new(),
                marked: true,
            };
            said.push(std::mem::replace(&mut cur, next));
            i = end;
        } else {
            if !dropping {
                cur.words.push(ws[i].clone());
            }
            i += 1;
        }
    }
    said.push(cur);
    found.then_some(said)
}

fn rejected(ws: &[String], i: usize) -> Option<usize> {
    let negating = NEGATING.iter().find(|m| i > 0 && starts(ws, i, m));
    negating.map(|m| m.len())
}

fn marker(ws: &[String], i: usize) -> Option<usize> {
    let loose = ws[i] == "лучше" && i >= 2 && i + 1 < ws.len();
    let len = REPLACE
        .iter()
        .find(|m| starts(ws, i, m) && !starts(ws, i, AT_LEAST))
        .map(|m| m.len())
        .or(loose.then_some(1))?;
    let end = skip_noise(ws, i + len);
    (end < ws.len()).then_some(end)
}

fn merge(said: Vec<Tok>, version: Version) -> Vec<Tok> {
    if !version.marked {
        return toks(&version.words);
    }
    let (words, alternative) = match after_not(&version.words) {
        Some(rest) => (rest, true),
        None => (version.words.as_slice(), false),
    };
    let next = toks(after_remark(words));
    if next.is_empty() {
        return said;
    }
    if next[0].w == "оставь" {
        return if next.len() == 1 {
            Vec::new()
        } else {
            toks(&["верни".into(), "как".into(), "было".into()])
        };
    }
    let part = reworded::amount(&said, &next).or_else(|| reworded::direction(&said, &next));
    if let Some(same_command) = part {
        return same_command;
    }
    let found = intent::detect(&next);
    if found.intent != crate::types::Intent::None && !found.blocked {
        return next;
    }
    let slot = said.iter().rposition(|t| numbers::is_number(&t.w));
    let digit = next.iter().find(|t| numbers::is_number(&t.w));
    if let (Some(at), Some(d)) = (slot, digit) {
        let mut out = said;
        out[at] = d.clone();
        return out;
    }
    let before = intent::detect(&said);
    let mut head: Vec<Tok> = before
        .used
        .iter()
        .filter_map(|&i| said.get(i).cloned())
        .collect();
    if head.is_empty() && alternative {
        head = toks(&["включи".into()]);
    }
    head.extend(next);
    head
}

fn after_not(said: &[String]) -> Option<&[String]> {
    if said.first().map(String::as_str) != Some("не") {
        return None;
    }
    let cut = said.iter().position(|w| w == "а")?;
    Some(&said[cut + 1..])
}

fn after_remark(said: &[String]) -> &[String] {
    let restart = said.iter().rposition(|w| w == RESTART).filter(|&at| at > 0);
    match restart {
        Some(at) if said[at + 1..].iter().any(|w| !noise(w)) => &said[skip_noise(said, at + 1)..],
        _ => said,
    }
}
