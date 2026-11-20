use super::latin_table::ALIASES;

const LETTERS: [&str; 26] = [
    "эй", "би", "си", "ди", "и", "эф", "джи", "эйч", "ай", "джей", "кей", "эл", "эм", "эн", "оу",
    "пи", "кью", "ар", "эс", "ти", "ю", "ви", "дабл-ю", "икс", "уай", "зед",
];

const MULTI: &[(&str, &str)] = &[
    ("tion", "шн"),
    ("sion", "жн"),
    ("ture", "чер"),
    ("ight", "айт"),
    ("igh", "ай"),
    ("sch", "ск"),
    ("tch", "ч"),
    ("dge", "дж"),
    ("ough", "оу"),
    ("ing", "инг"),
    ("ch", "ч"),
    ("sh", "ш"),
    ("th", "с"),
    ("ph", "ф"),
    ("ck", "к"),
    ("qu", "кв"),
    ("wh", "в"),
    ("gh", ""),
    ("ee", "и"),
    ("ea", "и"),
    ("oo", "у"),
    ("ou", "ау"),
    ("ow", "оу"),
    ("ai", "эй"),
    ("ay", "эй"),
    ("oa", "оу"),
    ("oi", "ой"),
    ("oy", "ой"),
    ("au", "о"),
    ("aw", "о"),
    ("ie", "и"),
    ("ei", "эй"),
    ("ey", "и"),
    ("ue", "ю"),
    ("ui", "ю"),
    ("ew", "ю"),
    ("er", "ер"),
    ("ar", "ар"),
    ("or", "ор"),
    ("ur", "ёр"),
    ("ir", "ёр"),
];

fn is_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'y')
}

fn single(c: char, next: Option<char>, first: bool, prev_vowel: bool, next_vowel: bool) -> &'static str {
    match c {
        'a' => "э",
        'e' => "э",
        'i' => "и",
        'o' => "о",
        'u' => "а",
        'y' if first || next_vowel => "й",
        'y' => "и",
        'b' => "б",
        'c' => match next {
            Some('e' | 'i' | 'y') => "с",
            _ => "к",
        },
        'd' => "д",
        'f' => "ф",
        'g' => "г",
        'h' => "х",
        'j' => "дж",
        'k' => "к",
        'l' => "л",
        'm' => "м",
        'n' => "н",
        'p' => "п",
        'q' => "к",
        'r' => "р",
        's' if prev_vowel && next_vowel => "з",
        's' => "с",
        't' => "т",
        'v' => "в",
        'w' => "в",
        'x' => "кс",
        'z' => "з",
        _ => "",
    }
}

fn magic_e(chars: &[char]) -> Option<usize> {
    let n = chars.len();
    if n < 3 || chars[n - 1] != 'e' || is_vowel(chars[n - 2]) || !is_vowel(chars[n - 3]) {
        return None;
    }
    if n >= 4 && is_vowel(chars[n - 4]) && chars[n - 4] != 'y' {
        return None;
    }
    Some(n - 3)
}

fn add_stress(reading: &str) -> String {
    let vowels = "аеёиоуыэюя";
    let count = reading.chars().filter(|c| vowels.contains(*c)).count();
    if count < 2 || reading.contains('+') {
        return reading.to_string();
    }
    let mut out = String::new();
    let mut done = false;
    for c in reading.chars() {
        if !done && vowels.contains(c) {
            out.push('+');
            done = true;
        }
        out.push(c);
    }
    out
}

fn transliterate(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let magic = magic_e(&chars);
    let mut out = String::new();
    let mut i = 0;
    let end = if magic.is_some() { chars.len() - 1 } else { chars.len() };
    'outer: while i < end {
        let rest: String = chars[i..end].iter().collect();
        if Some(i) == magic {
            let long = match chars[i] {
                'a' => "эй",
                'i' => "ай",
                'o' => "оу",
                'u' => "ю",
                'e' => "и",
                _ => "",
            };
            if !long.is_empty() {
                out.push_str(long);
                i += 1;
                continue;
            }
        }
        if i == 0 {
            for (from, to) in [("kn", "н"), ("wr", "р"), ("ps", "с")] {
                if rest.starts_with(from) {
                    out.push_str(to);
                    i += from.len();
                    continue 'outer;
                }
            }
        }
        for (from, to) in MULTI {
            if rest.starts_with(from) {
                if *from == "ing" && i == 0 {
                    break;
                }
                out.push_str(to);
                i += from.chars().count();
                continue 'outer;
            }
        }
        let prev_vowel = i > 0 && is_vowel(chars[i - 1]);
        let next_vowel = i + 1 < end && is_vowel(chars[i + 1]);
        let next = chars.get(i + 1).copied();
        let same = i + 1 < end && chars[i + 1] == chars[i] && !is_vowel(chars[i]);
        out.push_str(single(chars[i], next, i == 0, prev_vowel, next_vowel));
        i += if same { 2 } else { 1 };
    }
    add_stress(&out)
}

fn spell(word: &str) -> String {
    word.chars()
        .filter(|c| c.is_ascii_alphabetic())
        .map(|c| LETTERS[(c.to_ascii_lowercase() as u8 - b'a') as usize])
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn read_word(word: &str) -> String {
    let lower = word.to_lowercase();
    if let Some((_, reading)) = ALIASES.iter().find(|(k, _)| *k == lower) {
        return reading.to_string();
    }
    let letters = word.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let upper = word.chars().filter(|c| c.is_ascii_uppercase()).count();
    if letters >= 2 && letters <= 5 && upper == letters && !lower.chars().any(|c| "aeiouy".contains(c)) {
        return spell(word);
    }
    if letters >= 2 && letters <= 3 && upper == letters {
        return spell(word);
    }
    transliterate(&lower)
}

pub struct Aliases {
    order: Vec<(&'static str, &'static str)>,
}

impl Aliases {
    pub fn new() -> Self {
        let mut order: Vec<_> = ALIASES.iter().copied().collect();
        order.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
        Aliases { order }
    }

    pub fn replace(&self, text: &str) -> String {
        if !text.chars().any(|c| c.is_ascii_alphabetic()) {
            return text.to_string();
        }
        let chars: Vec<char> = text.chars().collect();
        let lower: Vec<char> = chars.iter().map(|c| c.to_ascii_lowercase()).collect();
        let mut out = String::new();
        let mut i = 0;
        while i < chars.len() {
            let boundary = i == 0 || !chars[i - 1].is_alphanumeric();
            if boundary && chars[i].is_ascii_alphanumeric() {
                let mut hit = None;
                for (key, reading) in &self.order {
                    let k: Vec<char> = key.chars().collect();
                    if i + k.len() <= chars.len()
                        && lower[i..i + k.len()] == k[..]
                        && !chars.get(i + k.len()).is_some_and(|c| c.is_alphanumeric())
                    {
                        hit = Some((k.len(), *reading));
                        break;
                    }
                }
                if let Some((len, reading)) = hit {
                    out.push_str(reading);
                    i += len;
                    continue;
                }
            }
            out.push(chars[i]);
            i += 1;
        }
        out
    }
}
