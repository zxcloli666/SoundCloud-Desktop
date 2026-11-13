use crate::intent::Detected;
use crate::lexicon::*;
use crate::normalize::Tok;
use crate::types::{Intent, Kind};

#[derive(Debug, Clone, Default)]
pub struct Raw {
    pub plain: Vec<Tok>,
    pub full: Vec<Tok>,
    pub artist: Option<Vec<Tok>>,
    pub title: Option<Vec<Tok>>,
}

#[derive(Debug, Clone, Default)]
pub struct Slots {
    pub kind_hint: Option<Kind>,
    pub raw: Raw,
    pub alt: Option<(Option<Kind>, Raw)>,
}

const WISHES: &[&str] = &["хочу", "хочется", "хотим"];
const OBJECT_ENDINGS: &[char] = &['у', 'ю'];

fn wished_last(toks: &[Tok], at: usize) -> bool {
    let named = at.checked_sub(1).map(|before| toks[before].w.as_str());
    let wish = at + 1 == toks.len() && WISHES.contains(&toks[at].w.as_str());
    wish && named.is_some_and(|name| !name.ends_with(OBJECT_ENDINGS))
}

fn kind_name_reading(rest: &[Tok]) -> Option<(Option<Kind>, Raw)> {
    let first = (0..rest.len().saturating_sub(1))
        .rev()
        .find(|&i| kind_of(&rest[i].w).is_some() && kind_of(&rest[i + 1].w).is_none())?;
    let mut hint = None;
    let mut kept: Vec<Tok> = Vec::new();
    for (i, t) in rest.iter().enumerate() {
        match kind_of(&t.w) {
            Some(k) if i != first => {
                hint = hint.or(Some(k));
            }
            _ => kept.push(t.clone()),
        }
    }
    Some((hint, split(trim(kept))))
}

pub(crate) fn kind_of(w: &str) -> Option<Kind> {
    if KIND_TRACK.contains(&w) {
        Some(Kind::Track)
    } else if KIND_TRACK_PLURAL.contains(&w) {
        Some(Kind::Artist)
    } else if KIND_ALBUM.contains(&w) {
        Some(Kind::Album)
    } else if KIND_PLAYLIST.contains(&w) {
        Some(Kind::Playlist)
    } else if KIND_ARTIST.contains(&w) {
        Some(Kind::Artist)
    } else {
        None
    }
}

const ENGLISH_EDGE: &[&str] = &[
    "you", "me", "for", "now", "right", "man", "dude", "bro", "some", "just", "maybe", "really",
    "like", "whatever", "know",
];

fn edge_noise(t: &Tok) -> bool {
    t.amb
        || PRE.contains(&t.w.as_str())
        || matches!(
            t.w.as_str(),
            "эту"
                | "этот"
                | "это"
                | "эта"
                | "этого"
                | "этой"
                | "музыку"
                | "музыка"
                | "для"
        )
        || ENGLISH_EDGE.contains(&t.w.as_str())
        || TRANSPORT_VERBS.contains(&t.w.as_str())
}

fn trim(mut v: Vec<Tok>) -> Vec<Tok> {
    let mut start = 0;
    while v.get(start).is_some_and(edge_noise) {
        v[start].amb = true;
        start += 1;
    }
    let mut end = v.len();
    while end > start && v.get(end - 1).is_some_and(edge_noise) {
        v[end - 1].amb = true;
        end -= 1;
    }
    v
}

pub fn extract(toks: &[Tok], det: &Detected) -> Slots {
    let wants_entity = matches!(
        det.intent,
        Intent::Play | Intent::QueueAdd | Intent::PlaySimilar
    );
    let bare = det.intent == Intent::None && !det.blocked;
    if !wants_entity && !bare {
        return Slots::default();
    }
    let rest: Vec<Tok> = toks
        .iter()
        .enumerate()
        .filter(|(i, _)| !det.used.contains(i) || (wants_entity && wished_last(toks, *i)))
        .map(|(_, t)| t.clone())
        .collect();
    let rest: Vec<Tok> = rest
        .into_iter()
        .map(|mut t| {
            if PLAY_WEAK.contains(&t.w.as_str()) && wants_entity {
                t.amb = true;
            }
            t
        })
        .collect();
    let rest = trim(rest);
    let described = without_descriptor(&rest);
    let mut hint = described.as_ref().map(|_| Kind::Artist);
    let rest = described.unwrap_or(rest);
    let mut kept: Vec<Tok> = Vec::new();
    let mut after_generic = false;
    let mut seen_kind = false;
    for (i, t) in rest.iter().enumerate() {
        let w = t.w.as_str();
        if matches!(w, "чтонибудь" | "чтото") {
            after_generic = true;
            continue;
        }
        if after_generic && matches!(w, "из" | "от" | "у" | "of" | "by") {
            after_generic = false;
            continue;
        }
        after_generic = false;
        if let Some(k) = kind_of(w) {
            let nominative_artist = k == Kind::Artist && !ARTIST_MARKERS.contains(&w);
            if nominative_artist && seen_kind {
                kept.push(t.clone());
                continue;
            }
            seen_kind = true;
            if hint.is_none() {
                hint = Some(k);
            }
            let marker = ARTIST_MARKERS.contains(&w) && !kept.is_empty() && i + 1 < rest.len();
            if !marker {
                while kept.last().is_some_and(points) {
                    kept.pop();
                }
                continue;
            }
        }
        kept.push(t.clone());
    }
    let kept = if kept.is_empty() {
        let kinds: Vec<&Tok> = rest.iter().filter(|t| kind_of(&t.w).is_some()).collect();
        match kinds.last() {
            Some(last) if kinds.len() >= 2 => vec![(*last).clone()],
            _ => kept,
        }
    } else {
        kept
    };
    let kept = trim(kept);
    Slots {
        kind_hint: hint,
        raw: split(kept),
        alt: kind_name_reading(&rest),
    }
}

fn points(t: &Tok) -> bool {
    matches!(t.w.as_str(), "вот" | "этот" | "эту" | "эта" | "эти")
}

fn without_descriptor(rest: &[Tok]) -> Option<Vec<Tok>> {
    let word = |i: usize| rest.get(i).map_or("", |t| t.w.as_str());
    let mut dropped = vec![false; rest.len()];
    for i in 0..rest.len() {
        let release = RECENT.contains(&word(i)) && is_release(word(i + 1));
        let generic = i > 0 && matches!(word(i - 1), "чтонибудь" | "чтото");
        let edge = i + 1 == rest.len() || ARTIST_MARKERS.contains(&word(i + 1));
        let alone = RECENT_ALONE.contains(&word(i)) && (generic || edge);
        if !release && !alone {
            continue;
        }
        dropped[i] = true;
        if release {
            dropped[i + 1] = true;
        }
        if i > 0 && SUPERLATIVE.contains(&word(i - 1)) {
            dropped[i - 1] = true;
        }
    }
    let left: Vec<Tok> = rest
        .iter()
        .zip(&dropped)
        .filter(|(_, gone)| !**gone)
        .map(|(t, _)| t.clone())
        .collect();
    let named = left.iter().any(is_name);
    (left.len() < rest.len() && named).then_some(left)
}

fn is_release(w: &str) -> bool {
    KIND_TRACK.contains(&w) || KIND_TRACK_PLURAL.contains(&w) || KIND_ALBUM.contains(&w)
}

fn is_name(t: &Tok) -> bool {
    let w = t.w.as_str();
    !edge_noise(t)
        && kind_of(w).is_none()
        && !ARTIST_MARKERS.contains(&w)
        && !matches!(w, "чтонибудь" | "чтото" | "из" | "-")
}

fn split(kept: Vec<Tok>) -> Raw {
    if let Some(d) = kept.iter().position(|t| t.w == "-") {
        let left: Vec<Tok> = kept[..d].to_vec();
        let right: Vec<Tok> = kept[d + 1..].to_vec();
        if !left.is_empty() && !right.is_empty() {
            let plain: Vec<Tok> = left.iter().chain(right.iter()).cloned().collect();
            return Raw {
                full: plain.clone(),
                plain,
                artist: Some(left),
                title: Some(right),
            };
        }
    }
    let kept: Vec<Tok> = kept.into_iter().filter(|t| t.w != "-").collect();
    let marker = kept
        .iter()
        .enumerate()
        .position(|(i, t)| ARTIST_MARKERS.contains(&t.w.as_str()) && !(i == 0 && kept.len() == 1));
    let Some(m) = marker else {
        return Raw {
            full: kept.clone(),
            plain: kept,
            ..Raw::default()
        };
    };
    let before: Vec<Tok> = kept[..m].to_vec();
    let after: Vec<Tok> = kept[m + 1..].to_vec();
    if after.is_empty() {
        return Raw {
            full: kept.clone(),
            plain: before,
            ..Raw::default()
        };
    }
    if before.is_empty() {
        return Raw {
            full: kept.clone(),
            plain: after.clone(),
            artist: Some(after),
            title: None,
        };
    }
    let before = own_version(before);
    let plain: Vec<Tok> = before.iter().chain(after.iter()).cloned().collect();
    Raw {
        full: kept.clone(),
        plain,
        artist: Some(after),
        title: Some(before),
    }
}

fn own_version(title: Vec<Tok>) -> Vec<Tok> {
    let opens = title.len() > COVER_OF.len() && title.iter().zip(COVER_OF).all(|(t, w)| t.w == *w);
    if opens {
        title[COVER_OF.len()..].to_vec()
    } else {
        title
    }
}
