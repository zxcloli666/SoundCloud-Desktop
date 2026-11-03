use crate::normalize::{Tok, normalize};
use crate::parse_toks;
use crate::types::{Intent, Parsed};

const MAX_STEPS: usize = 3;
const HARD: &[&str] = &["и", "and"];
const SOFT: &[&str] = &["потом", "затем", "then"];
const AFTER: &[&str] = &["него", "этого", "нее", "нее"];

enum Side {
    Cmd(Parsed),
    Foreign,
    Other,
}

struct Link {
    len: usize,
    soft: bool,
    queue: bool,
}

pub fn parse(text: &str) -> Vec<Parsed> {
    let spoken = correction(text);
    let toks = normalize(spoken.as_deref().unwrap_or(text)).toks;
    let from = usize::from(toks.len() > 2 && toks[0].w == "сначала");
    match plan(&toks[from..], text, false) {
        Some(steps) if steps.len() <= MAX_STEPS => collapse(steps),
        _ => vec![parse_toks(text, toks).0],
    }
}

fn link(toks: &[Tok], i: usize) -> Option<Link> {
    let w = toks[i].w.as_str();
    if HARD.contains(&w) {
        return Some(Link {
            len: 1,
            soft: false,
            queue: false,
        });
    }
    if SOFT.contains(&w) {
        return Some(Link {
            len: 1,
            soft: true,
            queue: false,
        });
    }
    let next = toks.get(i + 1).map(|t| t.w.as_str()).unwrap_or("");
    if w == "после" && AFTER.contains(&next) {
        return Some(Link {
            len: 2,
            soft: true,
            queue: true,
        });
    }
    None
}

fn side(toks: &[Tok], text: &str) -> Side {
    let (p, blocked) = parse_toks(text, toks.to_vec());
    if p.intent != Intent::None && (!p.intent.needs_entity() || !p.queries.is_empty()) {
        Side::Cmd(p)
    } else if blocked {
        Side::Foreign
    } else {
        Side::Other
    }
}

fn plan(toks: &[Tok], text: &str, inherit: bool) -> Option<Vec<Parsed>> {
    for i in 1..toks.len().saturating_sub(1) {
        let Some(l) = link(toks, i) else { continue };
        let mut start = i + l.len;
        while start < toks.len() && link(toks, start).is_some() {
            start += 1;
        }
        if start >= toks.len() {
            continue;
        }
        let left = match side(&toks[..i], text) {
            Side::Cmd(p) => Some(p),
            Side::Foreign => None,
            Side::Other if inherit && l.soft => match shared_verb(&toks[..i], text, false) {
                Some(p) => Some(p),
                None => continue,
            },
            Side::Other => continue,
        };
        let right = &toks[start..];
        let plays = left.as_ref().is_some_and(|p| p.intent == Intent::Play);
        let mut rest = match plan(right, text, l.soft && plays) {
            Some(steps) => steps,
            None => match side(right, text) {
                Side::Cmd(p) => vec![p],
                Side::Foreign => Vec::new(),
                Side::Other => match &left {
                    Some(lp) if l.soft && lp.intent == Intent::Play => {
                        match shared_verb(right, text, l.queue) {
                            Some(p) => vec![p],
                            None => continue,
                        }
                    }
                    _ => continue,
                },
            },
        };
        let mut steps: Vec<Parsed> = left.into_iter().collect();
        steps.append(&mut rest);
        if !steps.is_empty() {
            return Some(steps);
        }
    }
    None
}

fn shared_verb(toks: &[Tok], text: &str, queue: bool) -> Option<Parsed> {
    let (mut p, _) = parse_toks(text, toks.to_vec());
    if !p.bare || p.queries.is_empty() {
        return None;
    }
    p.bare = false;
    p.intent = if queue { Intent::QueueAdd } else { Intent::Play };
    Some(p)
}

fn collapse(steps: Vec<Parsed>) -> Vec<Parsed> {
    let mut out: Vec<Parsed> = Vec::new();
    for p in steps {
        let halts = |i: Intent| matches!(i, Intent::Stop | Intent::Pause);
        if p.intent == Intent::Play && out.last().is_some_and(|l| halts(l.intent)) {
            out.pop();
        }
        out.push(p);
    }
    out
}

fn correction(text: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let words: Vec<&str> = lower.split_whitespace().collect();
    let first = words.first()?;
    if matches!(*first, "не," | "нет," | "не.") && words.len() > 1 {
        return Some(words[1..].join(" "));
    }
    if *first != "не" || words.len() < 3 {
        return None;
    }
    let cut = words.iter().position(|w| matches!(*w, "а" | "а,"))?;
    (cut + 1 < words.len()).then(|| words[cut + 1..].join(" "))
}
