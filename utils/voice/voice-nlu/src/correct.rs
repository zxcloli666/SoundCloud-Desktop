use crate::intent;
use crate::lexicon::CORRECTION_NOISE;
use crate::normalize::{Tok, normalize, words};
use crate::numbers;

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

const NEGATING: &[&[&str]] = &[&["а", "не"], &["только", "не"], &["но", "не"], &["и", "не"]];

fn starts(ws: &[String], at: usize, marker: &[&str]) -> bool {
    at + marker.len() <= ws.len() && marker.iter().zip(&ws[at..]).all(|(m, w)| m == w)
}

fn skip_noise(ws: &[String], mut at: usize) -> usize {
    while at + 1 < ws.len() && CORRECTION_NOISE.contains(&ws[at].as_str()) {
        at += 1;
    }
    at
}

fn toks(ws: &[String]) -> Vec<Tok> {
    normalize(&ws.join(" ")).toks
}

pub fn resolve(text: &str) -> Option<Vec<Tok>> {
    let ws = words(text);
    let mut segs: Vec<Vec<String>> = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    let mut dropping = false;
    let mut found = false;
    let mut i = 0;
    while i < ws.len() {
        let negating = NEGATING.iter().find(|m| i > 0 && starts(&ws, i, m));
        let loose = ws[i] == "лучше" && i >= 2 && i + 1 < ws.len();
        let replace = REPLACE
            .iter()
            .find(|m| starts(&ws, i, m) && !starts(&ws, i, AT_LEAST))
            .map(|m| m.len())
            .or(loose.then_some(1))
            .filter(|len| skip_noise(&ws, i + len) < ws.len());
        if let Some(m) = negating {
            found = true;
            if !dropping {
                segs.push(std::mem::take(&mut cur));
            }
            dropping = true;
            i += m.len();
            continue;
        }
        if let Some(len) = replace {
            found = true;
            if !dropping {
                segs.push(std::mem::take(&mut cur));
            }
            dropping = false;
            i = skip_noise(&ws, i + len);
            continue;
        }
        if !dropping {
            cur.push(ws[i].clone());
        }
        i += 1;
    }
    if !found {
        return None;
    }
    if !dropping {
        segs.push(cur);
    }
    let mut acc: Vec<Tok> = Vec::new();
    for seg in segs.into_iter().filter(|s| !s.is_empty()) {
        acc = merge(acc, seg);
    }
    Some(acc)
}

fn after_not(seg: &[String]) -> Option<Vec<String>> {
    if seg.first().map(String::as_str) != Some("не") {
        return None;
    }
    let cut = seg.iter().position(|w| w == "а")?;
    Some(seg[cut + 1..].to_vec())
}

fn merge(prev: Vec<Tok>, seg: Vec<String>) -> Vec<Tok> {
    let (seg, via_not) = match after_not(&seg) {
        Some(rest) => (rest, true),
        None => (seg, false),
    };
    let next = toks(&seg);
    if next.is_empty() {
        return prev;
    }
    if next[0].w == "оставь" {
        return if next.len() == 1 {
            Vec::new()
        } else {
            toks(&["верни".into(), "как".into(), "было".into()])
        };
    }
    let found = intent::detect(&next);
    if found.intent != crate::types::Intent::None && !found.blocked {
        return next;
    }
    let slot = prev.iter().rposition(|t| numbers::is_number(&t.w));
    let digit = next.iter().find(|t| numbers::is_number(&t.w));
    if let (Some(at), Some(d)) = (slot, digit) {
        let mut out = prev;
        out[at] = d.clone();
        return out;
    }
    let before = intent::detect(&prev);
    let mut head: Vec<Tok> = before
        .used
        .iter()
        .filter_map(|&i| prev.get(i).cloned())
        .collect();
    if head.is_empty() && via_not {
        head = toks(&["включи".into()]);
    }
    head.extend(next);
    head
}
