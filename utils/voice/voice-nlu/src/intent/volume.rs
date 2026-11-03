use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 8 {
        return None;
    }
    let noun = c.pos_stem(&["громк", "звук", "volume", "vol", "sound"]);
    let times = c.has(&["раза", "раз"]);
    let number = c.number().filter(|_| !times);
    let implicit = c.pos(&["выкрути", "выкручивай", "накрути", "выкрутить"]);
    let half = c.has(HALF);
    let max = c.has(MAX_WORDS);
    let min = c.has(MIN_WORDS);

    if let Some(n) = noun {
        if (c.has(&["плюс"]) || c.has(&["минус"])) && number.is_some() {
            let intent = if c.has(&["плюс"]) {
                Intent::VolumeUp
            } else {
                Intent::VolumeDown
            };
            return Some(Detected::new(intent, vec![n]).number(number.unwrap_or(0).min(100)));
        }
        if c.at(n).starts_with("звук") || c.at(n).starts_with("sound") {
            if c.has(UNMUTE_WORDS) || (c.has(&["со"]) && c.has(&["звуком"])) {
                return Some(Detected::new(Intent::Unmute, vec![n]));
            }
        }
        let stepped = (c.has(UP_WORDS) || c.has(DOWN_WORDS)) && !c.has(&["до"]);
        let value = if stepped {
            None
        } else if let Some(v) = number {
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

    if let (Some(n), true) = (implicit, max) {
        return Some(Detected::new(Intent::VolumeSet, vec![n]).number(100));
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

    let english_dir =
        |dir: &str| c.has(&[dir]) && (c.has(&["turn", "volume", "sound", "it", "raise", "make"]));
    let up = c.has(UP_WORDS)
        || english_dir("up")
        || (c.has(&["increase", "raise"]) && noun.is_some())
        || (noun.is_some() && c.has(&["добавь", "добавить"]));
    let down = c.has(DOWN_WORDS)
        || english_dir("down")
        || (c.has(&["decrease", "lower", "reduce"]) && noun.is_some());
    if c.has(&["до"]) && (up || down || noun.is_some()) {
        if let Some(v) = number.or(max.then_some(100)) {
            return Some(Detected::new(Intent::VolumeSet, vec![]).number(v.min(100)));
        }
    }
    let mut used = c
        .all(UP_WORDS)
        .into_iter()
        .chain(c.all(DOWN_WORDS))
        .collect::<Vec<_>>();
    used.extend(noun);
    used.extend((0..c.len()).filter(|&i| crate::numbers::is_number(c.w[i])));
    used.extend(c.all(PLAY_STRONG));
    used.extend(c.all(&[
        "up",
        "down",
        "increase",
        "decrease",
        "raise",
        "lower",
        "reduce",
        "добавь",
        "добавить",
    ]));
    if (up || down) && c.stray(&used) > 0 {
        return None;
    }
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
