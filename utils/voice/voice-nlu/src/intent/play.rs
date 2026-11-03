use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

pub struct Verb {
    pub idx: usize,
    pub strong: bool,
    pub front: bool,
}

fn rambling(c: &Ctx) -> Option<Verb> {
    let limit = c.len().min(10);
    (1..limit)
        .find(|&i| IMPERATIVES.contains(&c.w[i]) && !c.w[..i].iter().any(|w| REPORT.contains(w)))
        .map(|idx| Verb {
            idx,
            strong: true,
            front: true,
        })
}

pub fn find_verb(c: &Ctx) -> Option<Verb> {
    for (list, strong) in [(PLAY_STRONG, true), (PLAY_WEAK, false)] {
        for i in 0..c.len() {
            if !list.contains(&c.w[i]) {
                continue;
            }
            if !strong && c.w[..i].iter().any(|w| SUBJECTS.contains(w)) {
                continue;
            }
            if c.only_pre(0..i) {
                return Some(Verb {
                    idx: i,
                    strong,
                    front: true,
                });
            }
            if i > 0 && c.only_pre(i + 1..c.len()) {
                return Some(Verb {
                    idx: i,
                    strong,
                    front: false,
                });
            }
        }
    }
    rambling(c)
}

fn is_kind(w: &str) -> bool {
    KIND_TRACK.contains(&w)
        || KIND_TRACK_PLURAL.contains(&w)
        || KIND_ALBUM.contains(&w)
        || KIND_PLAYLIST.contains(&w)
        || KIND_ARTIST.contains(&w)
}

pub fn forced(c: &Ctx) -> bool {
    let Some(v) = find_verb(c) else { return false };
    if !v.strong || !v.front {
        return false;
    }
    let Some(k) = (v.idx + 1..c.len()).find(|&i| is_kind(c.w[i])) else {
        return false;
    };
    let after: Vec<&str> = c.w[k + 1..]
        .iter()
        .copied()
        .filter(|w| !PRE.contains(w) || matches!(*w, "брат" | "братан" | "бро"))
        .collect();
    if after.is_empty() {
        return false;
    }
    if after
        .iter()
        .all(|w| crate::lexicon::stem(NEXT_STRONG, w) || crate::lexicon::stem(PREV_STRONG, w))
    {
        return false;
    }
    if after
        .iter()
        .any(|w| crate::lexicon::stem(&["избранн", "любим", "лайк"], w))
    {
        return false;
    }
    if after.first() == Some(&"на")
        && after
            .iter()
            .any(|w| crate::lexicon::stem(&["пауз", "повтор"], w))
    {
        return false;
    }
    true
}

const WEAK_ENTITY: &[&str] = &[
    "хочу",
    "хотел",
    "хотела",
    "хочется",
    "го",
    "дай",
    "бы",
    "хотелось",
];

fn entity_tokens(c: &Ctx, used: &[usize]) -> usize {
    (0..c.len())
        .filter(|i| !used.contains(i))
        .filter(|&i| {
            let w = c.w[i];
            let weak_after = WEAK_ENTITY.contains(&w) && i > 0;
            (weak_after || !PRE.contains(&w))
                && !GENERIC.contains(&w)
                && !is_kind(w)
                && !WAVE_NEEDS_VERB.contains(&w)
                && !RESUME_FILL.contains(&w)
                && !MINE.contains(&w)
                && !TRANSPORT_VERBS.contains(&w)
                && w != "-"
        })
        .count()
}

pub fn content(c: &Ctx) -> Option<Detected> {
    let verb = find_verb(c);
    let mut used: Vec<usize> = verb.iter().map(|v| v.idx).collect();
    if let Some(v) = &verb {
        if v.front {
            used.extend(0..v.idx);
        }
    }
    let has_verb = verb.is_some();

    let likes_word = c.pos(LIKES).or_else(|| c.pos_stem(&["избранн", "любим"]));
    let plural = c.pos(LIKES_PLURAL);
    let mine = c.has(MINE);
    let mine_things = mine
        && (plural.is_some()
            || c.has(KIND_TRACK_PLURAL)
            || c.has(&["треки", "песни", "музыку", "музыка", "tracks", "songs"]));
    let saving = c.has(&[
        "добавь",
        "добавить",
        "сохрани",
        "save",
        "удали",
        "убери",
        "сними",
    ]);
    if !saving
        && (likes_word.is_some()
            || mine_things
            || (plural.is_some() && has_verb && c.w[plural.unwrap()] != "лайк"))
    {
        let mut u = used.clone();
        u.extend(likes_word);
        u.extend(plural);
        if entity_tokens(c, &u) == 0 {
            return Some(Detected::new(Intent::PlayLikes, u));
        }
    }

    if has_verb && mine {
        let mut u = used.clone();
        u.extend(c.all(MINE));
        if entity_tokens(c, &u) == 0 {
            return Some(Detected::new(Intent::PlayLikes, u));
        }
    }

    if let Some(w) = c.pos(WAVE) {
        let mut u = used.clone();
        u.push(w);
        u.extend(c.all(&["меня"]));
        if entity_tokens(c, &u) == 0 {
            return Some(Detected::new(Intent::PlayWave, u));
        }
    }

    let similar_word = c.pos(SIMILAR);
    let like_this = c.has(&["like"]) && c.has(&["this", "that"]) && (has_verb || c.has(&["more"]));
    if (similar_word.is_some() || like_this) && (has_verb || c.len() <= 4) {
        let mut u = used.clone();
        u.extend(similar_word);
        for (i, w) in c.w.iter().enumerate() {
            if matches!(
                *w,
                "на" | "like"
                    | "to"
                    | "что"
                    | "чтонибудь"
                    | "чтото"
                    | "same"
                    | "этому"
                    | "это"
                    | "духе"
                    | "в"
                    | "таком"
                    | "же"
                    | "more"
            ) {
                u.push(i);
            }
        }
        return Some(Detected::new(Intent::PlaySimilar, u));
    }

    if has_verb {
        if let Some(w) = c.pos(WAVE_NEEDS_VERB) {
            let mut u = used.clone();
            u.push(w);
            if entity_tokens(c, &u) == 0 {
                return Some(Detected::new(Intent::PlayWave, u));
            }
        }
    }
    None
}

fn denied(c: &Ctx, used: &[usize]) -> bool {
    let first = (0..c.len())
        .filter(|i| !used.contains(i))
        .map(|i| c.w[i])
        .find(|w| {
            !PRE.contains(w) && !GENERIC.contains(w) && !TRANSPORT_VERBS.contains(w) && !is_kind(w)
        });
    first.is_some_and(|w| DENY.contains(&w))
}

pub fn detect(c: &Ctx, forced: bool) -> Detected {
    let Some(v) = find_verb(c) else {
        return Detected::none();
    };
    let mut used = vec![v.idx];
    if v.front {
        used.extend(0..v.idx);
    }
    if denied(c, &used) {
        return Detected::blocked();
    }
    if forced {
        return Detected::new(Intent::Play, used);
    }
    let strays = entity_tokens(c, &used);
    if strays == 0 {
        if !v.strong && c.len() == 1 {
            return Detected::new(Intent::Resume, used);
        }
        let only_kinds =
            c.w.iter()
                .enumerate()
                .any(|(i, w)| !used.contains(&i) && is_kind(w));
        if only_kinds {
            return Detected::new(Intent::PlayWave, used);
        }
        if v.strong || c.len() == 1 {
            return Detected::new(Intent::Resume, used);
        }
        return Detected::none();
    }
    if !v.strong && strays > 6 {
        return Detected::none();
    }
    let mut d = Detected::new(Intent::Play, used);
    d.weak = !v.strong;
    d
}
