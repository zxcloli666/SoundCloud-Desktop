use crate::correct;
use crate::intent;
use crate::lexicon::{LONE_VERBS, ON_VERB_FORMS, PLAY_STRONG, PLAY_WEAK};
use crate::names::Names;
use crate::normalize::{Tok, normalize};
use crate::parse_toks;
use crate::types::{Intent, Parsed};

const MAX_STEPS: usize = 3;
const HARD: &[&str] = &["и", "and"];
const SOFT: &[&str] = &["потом", "затем", "then", "только"];
const AFTER: &[&str] = &["него", "этого", "нее", "нее"];

enum Side {
    Cmd(Parsed),
    Foreign,
    Other,
}

struct Link {
    len: usize,
    soft: bool,
}

pub fn parse(text: &str, names: &Names) -> Vec<Parsed> {
    let spoken = correction(text);
    let text_in = spoken.as_deref().unwrap_or(text);
    let fixed = correct::resolve(text_in).filter(|_| !intent::retold(&normalize(text_in).toks));
    let corrected = fixed.is_some();
    let toks = names.drop(fixed.unwrap_or_else(|| normalize(text_in).toks));
    let from = usize::from(toks.len() > 2 && toks[0].w == "сначала");
    let toks = &toks[from..];
    let mut whole = parse_toks(text, toks.to_vec()).0;
    if intent::lyric(toks) {
        return vec![whole];
    }
    if let Some(steps) = linked(toks, text, false) {
        if steps.len() <= MAX_STEPS {
            return collapse(steps);
        }
    }
    if whole.intent.is_control() {
        return vec![whole];
    }
    let raw = crate::normalize::words(text_in);
    let repeated = raw.windows(2).any(|p| p[0] == p[1]);
    if whole.intent == Intent::None {
        if repeated {
            whole.bare = false;
            whole.queries.clear();
        }
        match juxtaposed(toks, text) {
            Some(steps) if steps.len() <= MAX_STEPS => return collapse(steps),
            _ => {}
        }
    }
    if corrected && whole.alt.is_empty() {
        whole.alt = crate::whole_name(&names.drop(normalize(text_in).toks));
    }
    whole.split = entity_splits(toks, text);
    if whole.intent == Intent::Play {
        whole
            .split
            .extend(juxtaposed(toks, text).filter(|s| s.len() <= MAX_STEPS));
    }
    vec![whole]
}

fn link(toks: &[Tok], i: usize) -> Option<Link> {
    let w = toks[i].w.as_str();
    if HARD.contains(&w) {
        return Some(Link {
            len: 1,
            soft: false,
        });
    }
    if SOFT.contains(&w) {
        return Some(Link { len: 1, soft: true });
    }
    let next = toks.get(i + 1).map(|t| t.w.as_str()).unwrap_or("");
    if w == "после" && AFTER.contains(&next) {
        return Some(Link { len: 2, soft: true });
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
    linked(toks, text, inherit).or_else(|| juxtaposed(toks, text))
}

fn linked(toks: &[Tok], text: &str, inherit: bool) -> Option<Vec<Parsed>> {
    for i in 1..toks.len().saturating_sub(1) {
        let Some(l) = link(toks, i) else { continue };
        let mut start = i + l.len;
        while start < toks.len() && (link(toks, start).is_some() || toks[start].w == "сначала")
        {
            start += 1;
        }
        if start >= toks.len() {
            continue;
        }
        if toks[..i].len() == 1 && PLAY_WEAK.contains(&toks[0].w.as_str()) {
            continue;
        }
        let mut left: Vec<Parsed> = match side(&toks[..i], text) {
            Side::Cmd(p) => {
                let inner = if p.intent == Intent::Play {
                    juxtaposed(&toks[..i], text)
                } else {
                    None
                };
                inner.unwrap_or_else(|| vec![p])
            }
            Side::Foreign => Vec::new(),
            Side::Other if inherit && l.soft => match shared_verb(&toks[..i], text, true) {
                Some(p) => vec![p],
                None => continue,
            },
            Side::Other => continue,
        };
        let right = &toks[start..];
        let seek = matches!(
            left.last().map(|p| p.intent),
            Some(Intent::SeekForward | Intent::SeekBackward | Intent::SeekTo)
        );
        if seek && crate::numbers::is_number(&right[0].w) {
            continue;
        }
        let plays = left
            .last()
            .is_some_and(|p| matches!(p.intent, Intent::Play | Intent::QueueAdd));
        let mut rest = match plan(right, text, l.soft && plays) {
            Some(steps) => steps,
            None => match side(right, text) {
                Side::Cmd(p) => vec![p],
                Side::Foreign => Vec::new(),
                Side::Other => match left.last() {
                    Some(lp) if l.soft && matches!(lp.intent, Intent::Play | Intent::QueueAdd) => {
                        match shared_verb(right, text, true) {
                            Some(p) => vec![p],
                            None => continue,
                        }
                    }
                    _ => continue,
                },
            },
        };
        left.append(&mut rest);
        if !left.is_empty() {
            return Some(left);
        }
    }
    None
}

fn after_play(i: Intent) -> bool {
    matches!(
        i,
        Intent::VolumeUp
            | Intent::VolumeDown
            | Intent::VolumeSet
            | Intent::ShuffleOn
            | Intent::ShuffleOff
            | Intent::RepeatOne
            | Intent::RepeatAll
            | Intent::RepeatOff
            | Intent::Mute
            | Intent::Unmute
    )
}

fn lone_verb(toks: &[Tok]) -> bool {
    toks.len() == 1 && LONE_VERBS.contains(&toks[0].w.as_str())
}

fn juxtaposed(toks: &[Tok], text: &str) -> Option<Vec<Parsed>> {
    if toks.len() < 2 || toks.len() > 10 {
        return None;
    }
    match side(toks, text) {
        Side::Cmd(p) if p.intent.is_control() => return None,
        Side::Foreign => return None,
        _ => {}
    }
    for i in 1..toks.len() {
        if lone_verb(&toks[..i]) || lone_verb(&toks[i..]) {
            continue;
        }
        let Side::Cmd(left) = side(&toks[..i], text) else {
            continue;
        };
        if !left.alt.is_empty() {
            continue;
        }
        let tail = &toks[i..];
        let rest = match plan(tail, text, false) {
            Some(steps) => steps,
            None => match side(tail, text) {
                Side::Cmd(p) => vec![p],
                _ => continue,
            },
        };
        if rest.iter().any(|p| !p.alt.is_empty()) {
            continue;
        }
        let control = |p: &Parsed| !p.intent.needs_entity();
        if rest
            .first()
            .is_some_and(|r| r.intent == left.intent && control(r))
        {
            continue;
        }
        if left.intent == Intent::Play && !rest.iter().all(|r| after_play(r.intent)) {
            continue;
        }
        if !control(&left) && !rest.iter().any(control) {
            continue;
        }
        let strong_start = PLAY_STRONG.contains(&toks[0].w.as_str());
        if left.intent == Intent::Play && !strong_start {
            continue;
        }
        if left.intent == Intent::Resume || rest.iter().any(|p| p.intent == Intent::Resume) {
            continue;
        }
        let mut steps = vec![left];
        steps.extend(rest);
        return Some(steps);
    }
    None
}

fn shared_verb(toks: &[Tok], text: &str, queue: bool) -> Option<Parsed> {
    let (mut p, _) = parse_toks(text, toks.to_vec());
    if !p.bare || p.queries.is_empty() {
        return None;
    }
    p.bare = false;
    p.intent = if queue {
        Intent::QueueAdd
    } else {
        Intent::Play
    };
    Some(p)
}

fn entity_splits(toks: &[Tok], text: &str) -> Vec<Vec<Parsed>> {
    let mut out = Vec::new();
    for i in 1..toks.len().saturating_sub(1) {
        if !HARD.contains(&toks[i].w.as_str()) {
            continue;
        }
        let Side::Cmd(left) = side(&toks[..i], text) else {
            continue;
        };
        if left.intent != Intent::Play {
            continue;
        }
        if let Some(right) = shared_verb(&toks[i + 1..], text, true) {
            out.push(vec![left, right]);
        }
    }
    out
}

fn off_form(i: Intent) -> Option<Intent> {
    match i {
        Intent::ShuffleOn => Some(Intent::ShuffleOff),
        Intent::RepeatOne | Intent::RepeatAll => Some(Intent::RepeatOff),
        _ => None,
    }
}

fn own_verb(p: &Parsed) -> bool {
    p.normalized
        .split(' ')
        .any(|w| LONE_VERBS.contains(&w) || ON_VERB_FORMS.contains(&w))
}

fn collapse(steps: Vec<Parsed>) -> Vec<Parsed> {
    let mut out: Vec<Parsed> = Vec::new();
    for mut p in steps {
        let halts = |i: Intent| matches!(i, Intent::Stop | Intent::Pause);
        if p.intent == Intent::Play && out.last().is_some_and(|l| halts(l.intent)) {
            out.pop();
        }
        if let Some(last) = out.last() {
            if matches!(last.intent, Intent::ShuffleOff | Intent::RepeatOff) && !own_verb(&p) {
                if let Some(off) = off_form(p.intent) {
                    p.intent = off;
                }
            }
            if last.intent == Intent::Mute && p.intent == Intent::Resume {
                p.intent = Intent::Unmute;
            }
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
