use crate::intent;
use crate::lexicon::{
    self, CORRECTION_NOISE, DROP_PHRASES, FILLERS, GENERIC, MERGE_PHRASES, PLAY_STRONG, PRE,
};
use crate::normalize::{Tok, normalize, words};
use crate::numbers;
use crate::reworded;
use crate::steps::{self, Side};
use crate::types::{Intent, Parsed};

const TAKES_BACK: &[&[&str]] = &[
    &["или", "нет"],
    &["а", "нет"],
    &["ой", "нет"],
    &["то", "есть"],
    &["в", "смысле"],
    &["тьфу", "ты"],
    &["вернее"],
    &["точнее"],
    &["тьфу"],
    &["нет"],
    &["no"],
];
const WAVERS: &[&[&str]] = &[&["хотя"], &["ой"], &["ладно"]];
const LOOSE: &str = "лучше";
const NO: &str = "нет";
const ENGLISH_NO: &str = "no";
const NOT: &str = "не";
const INSTEAD: &str = "а";
const NOT_INSTEAD: &[&str] = &["не", "нет", "то"];
const SWAPPED_MAX: usize = 3;
const SAYING: &[&str] = &[
    "да",
    "ну",
    "я",
    "же",
    "сказал",
    "сказала",
    "говорю",
    "говорил",
    "говорила",
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
    "так",
    "то",
    "туда",
    "ту",
    "тот",
    "та",
    "те",
    "это",
    "эту",
    "этот",
    "эта",
    "их",
    "его",
    "ее",
    "песня",
    "песню",
    "трек",
];

const TO_THE_ROOM: &[&str] = &["кто", "где", "мама", "папа", "мам", "пап"];
const TOO_MUCH: &[&str] = &["слишком", "чересчур", "очень", "совсем"];

const NEGATING: &[&[&str]] = &[&["а", "не"], &["только", "не"], &["но", "не"], &["и", "не"]];

#[derive(Default)]
struct Version {
    words: Vec<String>,
    marked: bool,
    firm: bool,
}

struct Mark {
    end: usize,
    firm: bool,
}

pub fn resolve(text: &str) -> Option<Vec<Tok>> {
    let versions = versions(&words(text))?;
    Some(versions.into_iter().fold(Vec::new(), merge))
}

pub fn by_a_filler(text: &str) -> bool {
    let ws = words(text);
    let mut marks = (0..ws.len())
        .filter(|&i| marker(&ws, i).is_some())
        .peekable();
    marks.peek().is_some() && marks.all(|i| lexicon::has(FILLERS, &ws[i]))
}

pub fn denies(text: &str) -> bool {
    let ws = words(text);
    (1..ws.len()).any(|i| negating(&ws, i).is_some())
}

fn negating(ws: &[String], i: usize) -> Option<&'static [&'static str]> {
    let polite = |m: &[&str]| {
        let not = i + m.len() - 1;
        DROP_PHRASES.iter().any(|p| starts(ws, not, p))
    };
    NEGATING
        .iter()
        .copied()
        .find(|m| starts(ws, i, m) && !polite(m))
}

fn versions(ws: &[String]) -> Option<Vec<Version>> {
    let mut said: Vec<Version> = Vec::new();
    let mut cur = Version::default();
    let mut dropping = false;
    let mut found = false;
    let mut i = 0;
    while i < ws.len() {
        if let Some(len) = rejected(ws, i, &cur) {
            found = true;
            dropping = true;
            i += len;
            if cur.words.iter().all(|w| SAYING.contains(&w.as_str())) {
                cur.words.clear();
            }
        } else if let Some(mark) = marker(ws, i)
            .filter(|m| m.firm || opened(&cur))
            .filter(|m| !starts_a_name(&cur, ws, i, m.end))
            .filter(|_| !word_of_a_name(&cur, &ws[i]))
        {
            found = true;
            dropping = false;
            let next = Version {
                words: Vec::new(),
                marked: true,
                firm: mark.firm,
            };
            said.push(std::mem::replace(&mut cur, next));
            i = mark.end;
        } else if dropping && resumes(ws, i) {
            dropping = false;
            i += 1;
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

fn starts_a_name(cur: &Version, ws: &[String], at: usize, end: usize) -> bool {
    let lone_verb = matches!(cur.words.as_slice(), [w] if PLAY_STRONG.contains(&w.as_str()));
    let bare_no = end == at + 1;
    let named = ws[end..].iter().all(|w| !lexicon::is_known(w));
    lone_verb && bare_no && named
}

fn word_of_a_name(cur: &Version, said: &str) -> bool {
    let controls = || command(&toks(&cur.words)).is_some_and(|(asked, ..)| asked.is_control());
    said == ENGLISH_NO && !cur.words.is_empty() && !controls()
}

fn opened(cur: &Version) -> bool {
    cur.words.iter().any(|w| !lexicon::has(FILLERS, w))
}

fn rejected(ws: &[String], i: usize, cur: &Version) -> Option<usize> {
    let denial = negating(ws, i).filter(|_| i > 0);
    let swapped = (i + 2..=i + 1 + SWAPPED_MAX).any(|j| resumes(ws, j));
    let alone = ws[i] == NOT && !cur.words.is_empty() && swapped;
    denial.map(|m| m.len()).or(alone.then_some(1))
}

fn resumes(ws: &[String], i: usize) -> bool {
    let instead = ws.get(i).is_some_and(|w| w == INSTEAD);
    let next = ws.get(i + 1).map(String::as_str);
    instead && next.is_some_and(|w| !NOT_INSTEAD.contains(&w)) && marker(ws, i + 1).is_none()
}

fn marker(ws: &[String], i: usize) -> Option<Mark> {
    if intent::absence(ws, i) || worn_out(ws, i) {
        return None;
    }
    let takes_back = TAKES_BACK.iter().find(|m| starts(ws, i, m));
    let wavers = WAVERS
        .iter()
        .find(|m| starts(ws, i, m) && !starts(ws, i, AT_LEAST));
    let loose = ws[i] == LOOSE && i >= 2 && i + 1 < ws.len();
    let len = takes_back
        .or(wavers)
        .map(|m| m.len())
        .or(loose.then_some(1))?;
    let end = skip_noise(ws, i + len);
    let firm = takes_back.is_some() || ws[i + len..end].iter().any(|w| w == NO);
    let closes = i + len == ws.len() && len > 1 && ws[end - 1] == NO;
    let end = if closes { end - 1 } else { end };
    (end < ws.len()).then_some(Mark { end, firm })
}

fn worn_out(ws: &[String], at: usize) -> bool {
    let near = &ws[at.saturating_sub(2)..(at + 3).min(ws.len())];
    ws[at] == "нет" && near.iter().any(|w| w == "сил")
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
    let to_the_room = next
        .first()
        .is_some_and(|t| TO_THE_ROOM.contains(&t.w.as_str()));
    let aside = to_the_room && command(&next).is_none();
    if next.is_empty() || (aside && !version.firm) {
        return if version.firm { Vec::new() } else { said };
    }
    if next.iter().all(|t| t.w == NO) {
        return Vec::new();
    }
    if left_as_it_is(&next) {
        let undone = said.is_empty() && next.len() > 1 && next[0].w == LEAVE;
        return if undone {
            normalize(AS_IT_WAS).toks
        } else {
            Vec::new()
        };
    }
    if command(&said).is_some() && intent::detect(&next).intent == Intent::Undo {
        return Vec::new();
    }
    if let Some(same_command) = reworded::part(&said, &next) {
        return same_command;
    }
    let read = steps::side(&next, "");
    if matches!(read, Side::Foreign) && !said.is_empty() {
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
    let first = command(&head);
    head.extend(next);
    let changed = command(&head).is_some_and(|now| Some(now) != first);
    if version.firm && before.intent.is_control() && !changed {
        return Vec::new();
    }
    head
}

fn command(said: &[Tok]) -> Option<(Intent, Option<u32>, Option<f32>)> {
    match steps::side(said, "") {
        Side::Cmd(p) => Some((p.intent, p.number, p.fraction)),
        _ => None,
    }
}

fn after_not(said: &[String]) -> Option<&[String]> {
    if said.first().map(String::as_str) != Some(NOT) {
        return None;
    }
    let cut = said.iter().position(|w| w == INSTEAD)?;
    Some(&said[cut + 1..])
}

fn after_rejection<'a>(words: &'a [String], said: &[Tok]) -> Option<&'a [String]> {
    let points = |w: &&String| POINTERS.contains(&w.as_str());
    let lead = words.iter().take_while(points).count();
    let denies = words.get(lead).is_some_and(|w| w == NOT);
    let own_meaning = MERGE_PHRASES.iter().any(|(p, _)| starts(words, lead, p));
    let again = words
        .iter()
        .skip(lead + 1)
        .take_while(|w| points(w) || echoes(w, said))
        .count();
    if said.is_empty() || !denies || own_meaning || again == 0 {
        return Some(words);
    }
    let rest = &words[lead + 1 + again..];
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
        Side::Cmd(p) if p.weak_verb && intent::detect(said).intent.needs_entity() => false,
        Side::Cmd(p) => from_its_start(&p, next),
        _ => steps::plan(next, "", false).is_some(),
    }
}

fn from_its_start(read: &Parsed, next: &[Tok]) -> bool {
    let kept: Vec<&str> = read.normalized.split(' ').collect();
    let from = |start: usize| {
        let first = next.get(start).map(|t| t.w.as_str());
        kept.len() == next.len() - start || kept.first().copied() == first
    };
    (0..=said_too_much(next)).any(from)
}

fn said_too_much(next: &[Tok]) -> usize {
    let too = |t: &Tok| TOO_MUCH.contains(&t.w.as_str());
    let judging = |t: &&Tok| POINTERS.contains(&t.w.as_str()) || too(t);
    let lead = next.iter().take_while(judging).count();
    if !next[..lead].iter().any(too) {
        return 0;
    }
    let quality = next.get(lead..=lead).filter(|_| lead + 1 < next.len());
    lead + usize::from(quality.is_some_and(|q| command(q).is_none()))
}

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
