use std::collections::HashMap;
use std::sync::OnceLock;

use super::{DENY, FUZZY_TARGETS, KIND_ARTIST, SLURRED_TARGETS, is_known, known_words};

const SPELLED_FROM: usize = 3;
const REDUCED_FROM: usize = 5;
const REFLEXIVE: &[&str] = &["ться", "тся", "тьца", "тца"];

struct Sounds {
    spelled: HashMap<String, &'static str>,
    reduced: HashMap<String, &'static str>,
}

pub fn by_ear(w: &str) -> Option<&'static str> {
    let len = w.chars().count();
    if len < SPELLED_FROM || is_known(w) || !w.chars().all(cyrillic) {
        return None;
    }
    let sounds = sounds();
    if let Some(word) = sounds.spelled.get(&spelled(w)) {
        return Some(word);
    }
    if len < REDUCED_FROM {
        return None;
    }
    sounds.reduced.get(&reduced(w)).copied()
}

fn sounds() -> &'static Sounds {
    static SOUNDS: OnceLock<Sounds> = OnceLock::new();
    SOUNDS.get_or_init(|| {
        let mut sounds = Sounds {
            spelled: HashMap::new(),
            reduced: HashMap::new(),
        };
        let name_like = |w: &str| DENY.contains(&w) || KIND_ARTIST.contains(&w);
        let words = known_words().filter(|w| w.chars().all(cyrillic) && !name_like(w));
        for word in words {
            sounds.spelled.entry(spelled(word)).or_insert(word);
        }
        for word in FUZZY_TARGETS.iter().chain(SLURRED_TARGETS) {
            sounds.reduced.entry(reduced(word)).or_insert(word);
        }
        sounds
    })
}

fn cyrillic(c: char) -> bool {
    ('а'..='я').contains(&c) || c == 'ё'
}

fn spelled(w: &str) -> String {
    let mut out = String::new();
    for c in w.chars() {
        let last = out.chars().last();
        let c = match c {
            'э' | 'ё' => 'е',
            'ы' if matches!(last, Some('ц' | 'ж' | 'ш')) => 'и',
            other => other,
        };
        if last != Some(c) || vowel(c) {
            out.push(c);
        }
    }
    if let Some(stem) = REFLEXIVE.iter().find_map(|end| out.strip_suffix(end)) {
        out = format!("{stem}ца");
    }
    match out.strip_prefix("чт") {
        Some(rest) => format!("шт{rest}"),
        None => out,
    }
}

fn reduced(w: &str) -> String {
    let heard = spelled(w).replace("ующ", "ущ");
    let last = heard.chars().count().saturating_sub(1);
    let unstressed = heard.chars().enumerate().map(|(i, c)| match c {
        'о' if i < last => 'а',
        'е' if i < last => 'и',
        other => other,
    });
    devoiced(unstressed.collect())
}

fn devoiced(w: String) -> String {
    let soft = w.ends_with('ь');
    let stem = w.strip_suffix('ь').unwrap_or(&w);
    let mut chars: Vec<char> = stem.chars().collect();
    if let Some(end) = chars.last_mut() {
        *end = match *end {
            'б' => 'п',
            'в' => 'ф',
            'г' => 'к',
            'д' => 'т',
            'ж' => 'ш',
            'з' => 'с',
            other => other,
        };
    }
    let mut out: String = chars.into_iter().collect();
    if soft {
        out.push('ь');
    }
    out
}

fn vowel(c: char) -> bool {
    "аеиоуыюя".contains(c)
}
