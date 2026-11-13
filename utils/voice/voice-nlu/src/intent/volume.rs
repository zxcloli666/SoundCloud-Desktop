use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

const GIVE_BACK: &[&str] = &["верни", "вернуть", "возвращай"];
const AS_IT_IS: &[&str] = &["сейчас", "было", "есть", "раньше"];
const SET_TO: &[&str] = &["set", "it", "to", "a", "at", "percent"];

fn than_it_is(c: &Ctx) -> Vec<usize> {
    match c.pos(&["чем"]) {
        Some(at) if AS_IT_IS.contains(&c.at(at + 1)) => vec![at, at + 1],
        _ => Vec::new(),
    }
}

fn names_what_to_play(c: &Ctx, noun: usize) -> bool {
    let of_the_volume = |i: usize| {
        let w = c.w[i];
        i == noun || crate::numbers::is_number(w) || is_known(w) || stem(&["процент"], w)
    };
    c.has(PLAY_STRONG) && !(0..c.len()).all(of_the_volume)
}

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 8 {
        return None;
    }
    if c.has(PLAY_STRONG) && c.has(&["музыку", "музыка"]) {
        return None;
    }
    let noun =
        c.w.iter()
            .position(|w| stem(VOL_STEMS, w) && !LOUD_ADJECTIVES.contains(w));
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
        let compared = c.has(MORE) || c.has(LESS) || c.has(HIGHER) || c.has(LOWER);
        let stepped = (c.has(UP_WORDS) || c.has(DOWN_WORDS) || compared) && !c.has(&["до"]);
        let value = if stepped {
            None
        } else if let Some(v) = number {
            let tenths = (1..=10).contains(&v) && !c.has_stem(&["процент", "percent"]);
            Some(if tenths { v * 10 } else { v.min(100) })
        } else if half {
            Some(50)
        } else if max {
            Some(100)
        } else if min {
            Some(0)
        } else {
            None
        };
        if let Some(v) = value.filter(|_| !names_what_to_play(c, n)) {
            return Some(Detected::new(Intent::VolumeSet, vec![n]).number(v));
        }
    }

    if max && noun.is_none() && implicit.is_none() {
        let at = c.pos(MAX_WORDS).unwrap_or(0);
        let mut said = c.all(PLAY_STRONG);
        said.push(at);
        if c.stray(&said) == 0 && c.len() <= 4 {
            return Some(Detected::new(Intent::VolumeSet, vec![at]).number(100));
        }
    }
    if let (Some(n), true) = (implicit, max) {
        return Some(Detected::new(Intent::VolumeSet, vec![n]).number(100));
    }

    if c.has(&["unmute"]) {
        return Some(Detected::new(Intent::Unmute, vec![]));
    }
    if let Some(m) = c.pos(MUTE_WORDS) {
        let named = c.w[m] == "mute";
        let lifted: Vec<usize> = c.all(OFF_VERBS).into_iter().filter(|&i| i != m).collect();
        let mut said = vec![m];
        said.extend(noun);
        said.extend(super::seek::wait(c));
        said.extend(c.all(SWEARS_AMB));
        if named {
            said.extend(c.all(PLAY_STRONG));
            said.extend(c.all(ON_VERBS));
            said.extend(lifted.iter().copied());
        }
        if c.stray(&said) == 0 {
            let lifts = named && !lifted.is_empty();
            let intent = if lifts { Intent::Unmute } else { Intent::Mute };
            return Some(Detected::new(intent, vec![]));
        }
    }
    if c.has(&["без"]) && c.has_stem(&["звук"]) {
        return Some(Detected::new(Intent::Mute, vec![]));
    }
    if c.has(&["со"]) && c.has(&["звуком"]) {
        return Some(Detected::new(Intent::Unmute, vec![]));
    }
    if let Some(n) = noun {
        if c.at(n).starts_with("звук") || c.at(n).starts_with("sound") {
            let mut off = c.all(OFF_VERBS);
            let asked = !off.is_empty() && !c.has(UP_WORDS) && !c.has(DOWN_WORDS);
            off.push(n);
            off.extend(super::seek::wait(c));
            off.extend(c.all(&["полностью", "совсем", "целиком"]));
            off.extend(c.all(SWEARS_AMB));
            if asked && c.stray(&off) == 0 {
                return Some(Detected::new(Intent::Mute, vec![n]));
            }
            let on = c.all(ON_VERBS);
            let mut used = on.clone();
            used.push(n);
            used.extend(c.all(AS_BEFORE));
            if !on.is_empty() && !c.has(UP_WORDS) && !c.has(DOWN_WORDS) && c.stray(&used) == 0 {
                return Some(Detected::new(Intent::Unmute, vec![n]));
            }
        }
        let given_back = c.all(GIVE_BACK);
        if c.at(n).starts_with("громкост") && !given_back.is_empty() {
            let mut used = given_back;
            used.push(n);
            used.extend(c.all(AS_BEFORE));
            if c.stray(&used) == 0 {
                return Some(Detected::new(Intent::Unmute, vec![n]));
            }
        }
    }

    let english_dir =
        |dir: &str| c.has(&[dir]) && (c.has(&["turn", "volume", "sound", "it", "raise", "make"]));
    let up = c.has(UP_WORDS)
        || english_dir("up")
        || (c.has(&["increase", "raise"]) && noun.is_some())
        || (noun.is_some() && c.has(&["добавь", "добавить"]))
        || (noun.is_some() && (c.has(MORE) || c.has(HIGHER)));
    let down = c.has(DOWN_WORDS)
        || english_dir("down")
        || (c.has(&["decrease", "lower", "reduce"]) && noun.is_some())
        || (noun.is_some() && (c.has(LESS) || c.has(LOWER)));
    let level = |after: usize| c.w.get(after).is_some_and(|w| crate::numbers::is_number(w));
    let to_a_level = (0..c.len())
        .any(|i| c.w[i] == "to" && (level(i + 1) || (c.at(i + 1) == "a" && level(i + 2))));
    let set_to = |w: &&str| SET_TO.contains(w) || crate::numbers::is_number(w);
    let only_set = c.has(&["set"]) && c.w.iter().all(set_to);
    if (c.has(&["до"]) || to_a_level) && (up || down || noun.is_some() || only_set) {
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
    if noun.is_some() {
        used.extend(c.all(MORE).into_iter().chain(c.all(LESS)));
        used.extend(c.all(HIGHER).into_iter().chain(c.all(LOWER)));
    }
    used.extend((0..c.len()).filter(|&i| crate::numbers::is_number(c.w[i])));
    used.extend(c.all(PLAY_STRONG));
    used.extend(super::seek::hedges(c));
    used.extend(than_it_is(c));
    let wait = super::seek::wait(c);
    used.extend(wait.iter().copied());
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
    let step = (0..c.len())
        .filter(|i| !wait.contains(i))
        .find_map(|i| crate::numbers::value(c.w[i]))
        .filter(|_| !times);
    let found = |intent| {
        let d = Detected::new(intent, used.clone());
        match step {
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
