use crate::intent;
use crate::lexicon::{CORRECTION_NOISE, GENERIC, MERGE_PHRASES, PRE};
use crate::normalize::{Tok, normalize, words};
use crate::numbers;
use crate::reworded;
use crate::steps::{self, Side};

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
const LEAVE: &str = "оставь";
const LET: &str = "пусть";
const AS_IT_IS: &[&str] = &[
    "играет",
    "будет",
    "идет",
    "остается",
    "как",
    "есть",
    "было",
    "дальше",
];
const AS_IT_WAS: &str = "верни как было";
const PLAY: &str = "включи";
const ECHO_MIN: usize = 4;
const POINTERS: &[&str] = &[
    "так", "то", "туда", "ту", "тот", "та", "те", "это", "эту", "этот", "эта", "их", "его", "ее",
];

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
    let Some(words) = after_rejection(words, &said) else {
        return Vec::new();
    };
    let next = toks(after_remark(words));
    if next.is_empty() {
        return said;
    }
    if left_as_it_is(&next) {
        let undone = said.is_empty() && next.len() > 1 && next[0].w == LEAVE;
        return if undone {
            normalize(AS_IT_WAS).toks
        } else {
            Vec::new()
        };
    }
    let part = reworded::amount(&said, &next).or_else(|| reworded::direction(&said, &next));
    if let Some(same_command) = part {
        return same_command;
    }
    let read = steps::side(&next, "");
    if matches!(read, Side::Foreign) {
        return Vec::new();
    }
    if orders(read, &next, &said) {
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
        head = normalize(PLAY).toks;
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

fn after_rejection<'a>(words: &'a [String], said: &[Tok]) -> Option<&'a [String]> {
    let denies = words.first().is_some_and(|w| w == "не");
    let own_meaning = MERGE_PHRASES.iter().any(|(p, _)| starts(words, 0, p));
    let again = words
        .iter()
        .skip(1)
        .take_while(|w| POINTERS.contains(&w.as_str()) || echoes(w, said))
        .count();
    if !denies || own_meaning || again == 0 {
        return Some(words);
    }
    let rest = &words[1 + again..];
    let from = rest.iter().position(|w| !noise(w))?;
    Some(&rest[from..])
}

fn echoes(word: &str, said: &[Tok]) -> bool {
    let shared = |t: &Tok| {
        let same = t.w.chars().zip(word.chars()).take_while(|(a, b)| a == b);
        same.count()
    };
    said.iter().any(|t| t.w == word || shared(t) >= ECHO_MIN)
}

fn after_remark(said: &[String]) -> &[String] {
    let restart = said.iter().rposition(|w| w == RESTART).filter(|&at| at > 0);
    match restart {
        Some(at) if said[at + 1..].iter().any(|w| !noise(w)) => &said[skip_noise(said, at + 1)..],
        _ => said,
    }
}

fn left_as_it_is(next: &[Tok]) -> bool {
    let nothing_else = next[1..].iter().all(|t| {
        let w = t.w.as_str();
        AS_IT_IS.contains(&w) || GENERIC.contains(&w) || PRE.contains(&w)
    });
    next[0].w == LEAVE || (next[0].w == LET && nothing_else)
}

fn orders(read: Side, next: &[Tok], said: &[Tok]) -> bool {
    match read {
        Side::Cmd(p) => !(p.weak_verb && intent::detect(said).intent.needs_entity()),
        _ => steps::plan(next, "", false).is_some(),
    }
}
