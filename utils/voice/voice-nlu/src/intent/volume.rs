use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 8 {
        return None;
    }
    let noun = c.pos_stem(&["громк", "звук", "volume", "vol", "sound"]);
    let number = c.number();
    let half = c.has(HALF);
    let max = c.has(MAX_WORDS);
    let min = c.has(MIN_WORDS);

    if let Some(n) = noun {
        if c.at(n).starts_with("звук") || c.at(n).starts_with("sound") {
            if c.has(UNMUTE_WORDS) || (c.has(&["со"]) && c.has(&["звуком"])) {
                return Some(Detected::new(Intent::Unmute, vec![n]));
            }
        }
        let value = if let Some(v) = number {
            Some(v.min(100))
        } else if half {
            Some(50)
        } else if max {
            Some(100)
        } else if min {
            Some(0)
        } else {
            None
        };
        if let Some(v) = value {
            return Some(Detected::new(Intent::VolumeSet, vec![n]).number(v));
        }
    }

    if c.has(&["unmute"]) {
        return Some(Detected::new(Intent::Unmute, vec![]));
    }
    if c.has(MUTE_WORDS) {
        return Some(Detected::new(Intent::Mute, vec![]));
    }
    if c.has(&["без"]) && c.has_stem(&["звук"]) {
        return Some(Detected::new(Intent::Mute, vec![]));
    }
    if c.has(&["со"]) && c.has(&["звуком"]) {
        return Some(Detected::new(Intent::Unmute, vec![]));
    }
    if let Some(n) = noun {
        if c.at(n).starts_with("звук") || c.at(n).starts_with("sound") {
            if c.has(OFF_VERBS) && !c.has(UP_WORDS) && !c.has(DOWN_WORDS) {
                return Some(Detected::new(Intent::Mute, vec![n]));
            }
            if c.has(ON_VERBS) && !c.has(UP_WORDS) && !c.has(DOWN_WORDS) {
                return Some(Detected::new(Intent::Unmute, vec![n]));
            }
        }
    }

    let english_dir = |dir: &str| {
        c.has(&[dir]) && (c.has(&["turn", "volume", "sound", "it", "raise", "make"]))
    };
    let up = c.has(UP_WORDS)
        || english_dir("up")
        || (c.has(&["increase", "raise"]) && noun.is_some())
        || (noun.is_some() && c.has(&["добавь", "добавить"]));
    let down = c.has(DOWN_WORDS)
        || english_dir("down")
        || (c.has(&["decrease", "lower", "reduce"]) && noun.is_some());
    let used = c.all(UP_WORDS).into_iter().chain(c.all(DOWN_WORDS)).collect::<Vec<_>>();
    let found = |intent| {
        let d = Detected::new(intent, used.clone());
        match number {
            Some(n) => d.number(n.min(100)),
            None => d,
        }
    };
    if down && !up {
        return Some(found(Intent::VolumeDown));
    }
    if up {
        return Some(found(Intent::VolumeUp));
    }
    None
}
