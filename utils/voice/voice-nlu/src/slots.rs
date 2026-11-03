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
}

fn kind_of(w: &str) -> Option<Kind> {
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

fn edge_noise(t: &Tok) -> bool {
    t.amb || (PRE.contains(&t.w.as_str()) || TRANSPORT_VERBS.contains(&t.w.as_str()))
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
        .filter(|(i, _)| !det.used.contains(i))
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
    let mut hint = None;
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
    }
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
    let plain: Vec<Tok> = before.iter().chain(after.iter()).cloned().collect();
    Raw {
        full: kept.clone(),
        plain,
        artist: Some(after),
        title: Some(before),
    }
}
