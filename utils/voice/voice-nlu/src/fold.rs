use crate::numbers;

const DROPPED: &[&str] = &["the", "зе", "зэ", "and", "и", "ze"];

pub fn fold(text: &str) -> String {
    let mut key = String::new();
    for word in fold_words(text) {
        key.push_str(&word);
    }
    dedupe(&key)
}

pub fn fold_words(text: &str) -> Vec<String> {
    let words = split_words(text);
    let words = numbers::merge(&words, true);
    let count = words.len();
    let mut out = Vec::new();
    for (i, w) in words.iter().enumerate() {
        if count > 1 && DROPPED.contains(&w.as_str()) {
            continue;
        }
        let phon = if w.chars().all(|c| c.is_ascii_digit()) {
            w.clone()
        } else if w.chars().any(|c| ('а'..='я').contains(&c) || c == 'ё') {
            cyrillic(w)
        } else {
            latin(w)
        };
        if !phon.is_empty() {
            out.push(dedupe(&phon));
        }
        let _ = i;
    }
    out
}

fn base_letter(c: char) -> char {
    match c {
        'å' | 'ä' | 'á' | 'à' | 'â' | 'ã' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ö' | 'ó' | 'ò' | 'ô' | 'õ' | 'ø' => 'o',
        'ü' | 'ú' | 'ù' | 'û' => 'u',
        'ñ' => 'n',
        'ç' => 's',
        'š' => 'S',
        'ž' => 'Z',
        'ё' => 'е',
        other => other,
    }
}

fn split_words(text: &str) -> Vec<String> {
    let mut words: Vec<String> = Vec::new();
    let mut cur = String::new();
    let mut cur_digit = false;
    for c in text.to_lowercase().chars() {
        if matches!(c, '\'' | '’' | '`' | 'ʼ') {
            continue;
        }
        if !c.is_alphanumeric() {
            if !cur.is_empty() {
                words.push(std::mem::take(&mut cur));
            }
            continue;
        }
        let digit = c.is_ascii_digit();
        if !cur.is_empty() && digit != cur_digit {
            words.push(std::mem::take(&mut cur));
        }
        cur_digit = digit;
        cur.push(base_letter(c));
    }
    if !cur.is_empty() {
        words.push(cur);
    }
    words
}

fn dedupe(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        if out.chars().last() != Some(c) || c.is_ascii_digit() {
            out.push(c);
        }
    }
    out
}

fn is_cyr_vowel(c: char) -> bool {
    "аеёиоуыэюя".contains(c)
}

fn cyrillic(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        let prev = if i > 0 { Some(chars[i - 1]) } else { None };
        let next = chars.get(i + 1).copied();
        let piece = match c {
            'а' => "a",
            'б' => "b",
            'в' => "v",
            'г' => "g",
            'д' => "d",
            'е' | 'э' => "e",
            'ё' => "o",
            'ж' => "Z",
            'з' => "z",
            'и' | 'ы' => "i",
            'й' => {
                let before_vowel = next.is_some_and(is_cyr_vowel);
                if before_vowel && !prev.is_some_and(is_cyr_vowel) {
                    ""
                } else if before_vowel {
                    ""
                } else {
                    "i"
                }
            }
            'к' => "k",
            'л' => "l",
            'м' => "m",
            'н' => "n",
            'о' => "o",
            'п' => "p",
            'р' => "r",
            'с' => "s",
            'т' => "t",
            'у' => {
                if i == 0 && next.is_some_and(is_cyr_vowel) {
                    "v"
                } else {
                    "u"
                }
            }
            'ф' => "f",
            'х' => "h",
            'ц' => "c",
            'ч' => "C",
            'ш' | 'щ' => "S",
            'ъ' | 'ь' => "",
            'ю' => "u",
            'я' => "a",
            'a'..='z' | '0'..='9' | 'A'..='Z' => {
                out.push(c);
                continue;
            }
            _ => "",
        };
        out.push_str(piece);
    }
    out
}

fn is_vowel_letter(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u')
}

fn latin(word: &str) -> String {
    let c: Vec<char> = word.chars().collect();
    let n = c.len();
    let at = |i: usize, pat: &str| -> bool {
        let p: Vec<char> = pat.chars().collect();
        i + p.len() <= n && c[i..i + p.len()] == p[..]
    };
    let ch = |i: usize| -> char { c.get(i).copied().unwrap_or(' ') };
    let mut out = String::new();
    let mut i = 0;
    if at(0, "kn") {
        i = 1;
    } else if at(0, "wr") {
        i = 1;
    } else if at(0, "wh") {
        out.push('v');
        i = 2;
    }
    while i < n {
        let cur = c[i];
        let prev = if i > 0 { ch(i - 1) } else { ' ' };
        let next = ch(i + 1);
        let mut step = 1;
        match cur {
            't' if at(i, "tch") => {
                out.push('C');
                step = 3;
            }
            't' if at(i, "tion") => {
                out.push_str("Sn");
                step = 4;
            }
            't' if at(i, "th") => {
                out.push('s');
                step = 2;
            }
            't' if at(i, "ts") || at(i, "tz") => {
                out.push('c');
                step = 2;
            }
            'c' if at(i, "ch") => {
                out.push('C');
                step = 2;
            }
            'c' if at(i, "ck") => {
                out.push('k');
                step = 2;
            }
            'c' if matches!(next, 'e' | 'i' | 'y') => out.push('s'),
            'c' => out.push('k'),
            's' if at(i, "sch") => {
                out.push_str("Sk");
                step = 3;
            }
            's' if at(i, "sh") => {
                out.push('S');
                step = 2;
            }
            'p' if at(i, "ph") => {
                out.push('f');
                step = 2;
            }
            'g' if at(i, "gh") => {
                let tail = i + 2 >= n || ch(i + 2) == 't';
                if !tail && !is_vowel_letter(prev) {
                    out.push('g');
                }
                if is_vowel_letter(prev) && !tail {
                    out.push('g');
                }
                step = 2;
            }
            'g' if matches!(next, 'e' | 'i' | 'y') && prev != 'g' && !at(i, "gg") => out.push_str("dZ"),
            'g' => out.push('g'),
            'd' if at(i, "dge") || at(i, "dgi") => {
                out.push_str("dZ");
                step = 2;
            }
            'j' => out.push_str("dZ"),
            'q' if at(i, "qu") => {
                out.push_str("kv");
                step = 2;
            }
            'q' => out.push('k'),
            'x' => out.push_str("ks"),
            'z' => out.push('z'),
            'w' => {
                if is_vowel_letter(next) || i == 0 {
                    out.push('v');
                }
            }
            'y' => {
                if is_vowel_letter(next) && (i == 0 || !is_vowel_letter(prev)) {
                } else if is_vowel_letter(prev) {
                } else {
                    out.push('i');
                }
            }
            'e' if i + 1 == n && n > 3 && !is_vowel_letter(prev) && prev != 'y' => {}
            'e' if at(i, "ee") || at(i, "ea") => {
                out.push('i');
                step = 2;
            }
            'e' if at(i, "ei") || at(i, "ey") => {
                out.push_str("ei");
                step = 2;
            }
            'e' if at(i, "ew") => {
                out.push('u');
                step = 2;
            }
            'o' if at(i, "oo") => {
                out.push('u');
                step = 2;
            }
            'o' if at(i, "ou") || at(i, "ow") => {
                out.push_str("au");
                step = 2;
            }
            'o' if at(i, "oa") => {
                out.push('o');
                step = 2;
            }
            'o' if at(i, "oi") || at(i, "oy") => {
                out.push_str("oi");
                step = 2;
            }
            'a' if at(i, "ai") || at(i, "ay") => {
                out.push_str("ei");
                step = 2;
            }
            'a' if at(i, "au") || at(i, "aw") => {
                out.push('o');
                step = 2;
            }
            'i' if at(i, "igh") => {
                out.push_str("ai");
                step = 3;
            }
            'i' if at(i, "ie") => {
                out.push('i');
                step = 2;
            }
            'u' if at(i, "ui") => {
                out.push('i');
                step = 2;
            }
            'a' | 'e' | 'i' | 'o' | 'u' => out.push(cur),
            'b' | 'd' | 'f' | 'h' | 'k' | 'l' | 'm' | 'n' | 'p' | 'r' | 's' | 't' | 'v' => out.push(cur),
            'A'..='Z' | '0'..='9' => out.push(cur),
            _ => {}
        }
        i += step;
    }
    out
}

pub fn skeleton(key: &str) -> String {
    let mut out = String::new();
    for c in key.chars() {
        let m = match c {
            'a' | 'e' | 'i' | 'o' | 'u' | 'h' => continue,
            'p' => 'b',
            't' => 'd',
            'k' => 'g',
            'f' => 'v',
            'z' | 'c' => 's',
            'Z' | 'C' => 'S',
            other => other,
        };
        if out.chars().last() != Some(m) {
            out.push(m);
        }
    }
    out
}

fn is_vowel(c: char) -> bool {
    is_vowel_letter(c)
}

fn sub_cost(a: char, b: char) -> f32 {
    if a == b {
        return 0.0;
    }
    if is_vowel(a) && is_vowel(b) {
        return match (a, b) {
            ('a', 'o') | ('o', 'a') | ('e', 'i') | ('i', 'e') => 0.2,
            ('o', 'u') | ('u', 'o') | ('a', 'e') | ('e', 'a') => 0.3,
            _ => 0.4,
        };
    }
    if is_vowel(a) != is_vowel(b) {
        let pair = if is_vowel(a) { (b, a) } else { (a, b) };
        return match pair {
            ('v', 'u') => 0.5,
            _ => 1.0,
        };
    }
    let pair = if a < b { (a, b) } else { (b, a) };
    match pair {
        ('b', 'p') | ('d', 't') | ('g', 'k') | ('f', 'v') | ('s', 'z') | ('S', 'Z') | ('C', 'S') | ('c', 's') | ('C', 'c') => 0.4,
        ('h', 'k') | ('s', 't') | ('d', 'z') | ('m', 'n') | ('b', 'v') | ('S', 's') | ('C', 't') => 0.6,
        _ => 1.0,
    }
}

fn indel_cost(c: char) -> f32 {
    if is_vowel(c) {
        0.35
    } else if c == 'h' {
        0.4
    } else {
        1.0
    }
}

pub fn distance(a: &str, b: &str) -> f32 {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<f32> = Vec::with_capacity(b.len() + 1);
    prev.push(0.0);
    for j in 0..b.len() {
        prev.push(prev[j] + indel_cost(b[j]));
    }
    for i in 0..a.len() {
        let mut cur = Vec::with_capacity(b.len() + 1);
        cur.push(prev[0] + indel_cost(a[i]));
        for j in 0..b.len() {
            let sub = prev[j] + sub_cost(a[i], b[j]);
            let del = prev[j + 1] + indel_cost(a[i]);
            let ins = cur[j] + indel_cost(b[j]);
            cur.push(sub.min(del).min(ins));
        }
        prev = cur;
    }
    prev[b.len()]
}

pub fn similarity(a: &str, b: &str) -> f32 {
    let longest = a.chars().count().max(b.chars().count());
    if longest == 0 {
        return 0.0;
    }
    (1.0 - distance(a, b) / longest as f32).max(0.0)
}
