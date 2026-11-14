use super::abbrev;
use super::latin::{read_word, Aliases};
use super::nouns::{self, MONTHS_GEN};
use super::numbers::{cardinal, ordinal, Case, Gender};
use super::tokens::{tokenize, Number, Tok};

pub struct Normalizer {
    aliases: Aliases,
}

struct Out {
    parts: Vec<String>,
}

impl Out {
    fn word(&mut self, w: impl Into<String>) {
        self.parts.push(w.into());
    }

    fn words(&mut self, ws: Vec<String>) {
        self.parts.extend(ws);
    }

    fn punct(&mut self, p: &str) {
        if let Some(last) = self.parts.last_mut() {
            if !matches!(last.as_str(), "," | "." | "!" | "?" | ";" | ":" | "…" | "—") {
                last.push_str(p);
                return;
            }
        }
        if !self.parts.is_empty() {
            self.parts.push(p.to_string());
        }
    }

    fn render(self) -> String {
        let mut text = String::new();
        for part in self.parts {
            let attach = matches!(part.as_str(), "," | "." | "!" | "?" | ";" | ":" | "…");
            if !text.is_empty() && !attach {
                text.push(' ');
            }
            text.push_str(&part);
        }
        text
    }
}

fn case_after(prev: Option<&str>) -> Case {
    match prev {
        Some(
            "до" | "от" | "из" | "без" | "около" | "после" | "для" | "кроме" | "вместо" | "среди"
            | "возле" | "с" | "со" | "более" | "менее" | "свыше" | "у" | "ото" | "из-за" | "ниже"
            | "выше",
        ) => Case::Gen,
        Some("к" | "ко" | "по") => Case::Dat,
        Some("через" | "за" | "про" | "на" | "в" | "во" | "под") => Case::Acc,
        Some("над" | "между" | "перед" | "надо" | "передо") => Case::Ins,
        Some("о" | "об" | "обо" | "при") => Case::Pre,
        _ => Case::Nom,
    }
}

fn is_preposition_pre(prev: Option<&str>) -> bool {
    matches!(prev, Some("в" | "во" | "на" | "о" | "об" | "при"))
}

fn suffix_form(suffix: &str, prev: Option<&str>, next_gender: Option<Gender>) -> (Case, Gender) {
    let pre = is_preposition_pre(prev);
    match suffix {
        "я" | "ая" => (Case::Nom, Gender::F),
        "ю" | "ую" => (Case::Acc, Gender::F),
        "е" | "ое" => (Case::Nom, Gender::N),
        "го" | "ого" | "его" => (Case::Gen, Gender::M),
        "му" | "ому" | "ему" => (Case::Dat, Gender::M),
        "м" | "ым" | "им" | "ом" if pre => (Case::Pre, Gender::M),
        "м" | "ым" | "им" | "ом" => (Case::Ins, Gender::M),
        "х" | "ых" | "их" if pre => (Case::Pre, Gender::P),
        "х" | "ых" | "их" => (Case::Gen, Gender::P),
        "ми" | "ыми" | "ими" => (Case::Ins, Gender::P),
        _ => {
            if next_gender == Some(Gender::F) && prev.is_some() {
                (case_after(prev), Gender::F)
            } else {
                (Case::Nom, Gender::M)
            }
        }
    }
}

fn count_class(n: u64) -> u8 {
    let last = n % 10;
    let teen = n % 100 / 10 == 1;
    if last == 1 && !teen {
        0
    } else if (2..=4).contains(&last) && !teen {
        1
    } else {
        2
    }
}

fn digit_words(digits: &str) -> Vec<String> {
    digits
        .chars()
        .filter_map(|c| c.to_digit(10))
        .flat_map(|d| cardinal(d as u64, Case::Nom, Gender::M))
        .collect()
}

fn fraction_denominator(len: usize, one: bool) -> &'static str {
    match (len, one) {
        (1, true) => "десятая",
        (1, false) => "десятых",
        (2, true) => "сотая",
        (2, false) => "сотых",
        (_, true) => "тысячная",
        _ => "тысячных",
    }
}

impl Normalizer {
    pub fn new() -> Self {
        Normalizer {
            aliases: Aliases::new(),
        }
    }

    pub fn run(&self, text: &str) -> String {
        let text = abbrev::expand(text);
        let text = self.aliases.replace(&text);
        let toks = tokenize(&text);
        let mut out = Out { parts: Vec::new() };
        let mut prev: Option<String> = None;
        let mut i = 0;
        while i < toks.len() {
            match &toks[i] {
                Tok::Word(w) => {
                    let w = if w.chars().any(|c| c.is_ascii_alphabetic()) {
                        read_word(w)
                    } else {
                        w.to_lowercase()
                    };
                    let w = w.replace('’', "");
                    for piece in w.split(' ') {
                        out.word(piece);
                    }
                    prev = Some(w.to_lowercase());
                    i += 1;
                }
                Tok::Num(n) => {
                    let used = Self::number(&toks, i, n, prev.as_deref(), &mut out);
                    prev = None;
                    i += used;
                }
                Tok::Time(h, m) => {
                    out.words(time_words(*h, *m));
                    prev = None;
                    i += 1;
                }
                Tok::Date(d, m, y) => {
                    out.words(date_words(*d, *m, *y, case_after(prev.as_deref())));
                    prev = None;
                    i += 1;
                }
                Tok::Space => i += 1,
                Tok::Sym(c) => {
                    i += self.symbol(&toks, i, *c, &mut out);
                    prev = None;
                }
            }
        }
        out.render()
    }

    pub(crate) fn figure(toks: &[Tok], i: usize, prev: Option<&str>) -> Option<(Vec<String>, usize)> {
        let mut out = Out { parts: Vec::new() };
        let used = match toks.get(i)? {
            Tok::Num(_) if matches!(toks.get(i + 1), Some(Tok::Word(_))) && unit_at(toks, i + 1).is_none() => return None,
            Tok::Num(n) => Self::number(toks, i, n, prev, &mut out),
            Tok::Time(h, m) => {
                out.words(time_words(*h, *m));
                1
            }
            Tok::Date(d, m, y) => {
                out.words(date_words(*d, *m, *y, case_after(prev)));
                1
            }
            _ => return None,
        };
        Some((out.parts, used))
    }

    fn symbol(&self, toks: &[Tok], i: usize, c: char, out: &mut Out) -> usize {
        let prev_tok = if i > 0 { Some(&toks[i - 1]) } else { None };
        let next_tok = toks.get(i + 1);
        match c {
            ',' | ';' | ':' | '.' | '!' | '?' => out.punct(&c.to_string()),
            '…' => out.punct("…"),
            '\n' => out.punct("."),
            '(' | ')' | '[' | ']' => out.punct(","),
            '—' | '–' => out.word("—"),
            '-' | '−' => {
                let after_num = matches!(prev_tok, Some(Tok::Num(_)));
                let before_num = matches!(next_tok, Some(Tok::Num(_)));
                let glued_start = matches!(prev_tok, None | Some(Tok::Space)) && before_num;
                if glued_start {
                    out.word("минус");
                } else if after_num && before_num {
                    out.word("—");
                } else if matches!(prev_tok, Some(Tok::Space)) {
                    out.word("—");
                }
            }
            '+' => out.word("плюс"),
            '=' => out.word("равно"),
            '@' => out.word("собака"),
            '#' => out.word("хэштег"),
            '%' => out.word("процентов"),
            '°' => out.word("градусов"),
            '₽' => out.word("рублей"),
            '$' => out.word("долларов"),
            '€' => out.word("евро"),
            _ => {}
        }
        1
    }

    fn number(toks: &[Tok], i: usize, n: &Number, prev: Option<&str>, out: &mut Out) -> usize {
        let case = case_after(prev);
        let next = next_significant(toks, i + 1);
        let next_word = next.and_then(|j| match &toks[j] {
            Tok::Word(w) => Some((j, w.to_lowercase())),
            _ => None,
        });
        let next_gender = following_gender(toks, i + 1);

        if n.int.len() > 9 || (n.int.len() > 1 && n.int.starts_with('0') && n.frac.is_none()) {
            out.words(digit_words(&n.int));
            return 1;
        }
        let value: u64 = n.int.parse().unwrap_or(0);

        if let Some(sfx) = &n.suffix {
            let (c, g) = suffix_form(sfx, prev, next_gender);
            out.words(ordinal(value, c, g));
            return 1;
        }

        if let Some((_, word)) = &next_word {
            if let Some(slot) = nouns::is_year_noun(word) {
                if (1000..=2100).contains(&value) && n.frac.is_none() {
                    let c = match slot {
                        1 => Case::Gen,
                        2 if is_preposition_pre(prev) => Case::Pre,
                        2 => Case::Dat,
                        4 => Case::Ins,
                        _ => Case::Nom,
                    };
                    out.words(ordinal(value, c, Gender::M));
                    return 1;
                }
            }
        }

        if let Some(frac) = &n.frac {
            let mut words = cardinal(value, Case::Nom, Gender::F);
            words.push(if count_class(value) == 0 { "целая" } else { "целых" }.to_string());
            let fv: u64 = frac.parse().unwrap_or(0);
            for _ in frac.chars().take_while(|c| *c == '0') {
                words.push("ноль".to_string());
            }
            if fv > 0 {
                words.extend(cardinal(fv, Case::Nom, Gender::F));
            }
            words.push(fraction_denominator(frac.len(), count_class(fv) == 0).to_string());
            out.words(words);
            return 1 + Self::fraction_unit(toks, i, out);
        }

        if let Some(used) = Self::unit_phrase(toks, i, value, case, out) {
            return used;
        }

        let gender = next_gender.unwrap_or(Gender::M);
        let gender = if gender == Gender::P { Gender::M } else { gender };
        out.words(cardinal(value, case, gender));
        1
    }

    fn fraction_unit(toks: &[Tok], i: usize, out: &mut Out) -> usize {
        if let Some(j) = next_significant(toks, i + 1) {
            if let Some((unit, last)) = unit_at(toks, j) {
                out.word(unit.few);
                return last - i;
            }
        }
        0
    }

    fn unit_phrase(toks: &[Tok], i: usize, value: u64, case: Case, out: &mut Out) -> Option<usize> {
        let j = next_significant(toks, i + 1)?;
        let (unit, last) = unit_at(toks, j)?;
        let class = count_class(value);
        let word = match (class, case) {
            (0, Case::Nom | Case::Acc) => unit.one,
            (0, _) => unit.few,
            (1, Case::Nom | Case::Acc | Case::Gen) => unit.few,
            _ => unit.many,
        };
        let gender = if unit.gender == Gender::P { Gender::M } else { unit.gender };
        out.words(cardinal(value, case, gender));
        out.word(word);
        let mut used = last - i + 1;
        if unit.names.contains(&"°") {
            if let Some(Tok::Word(w)) = toks.get(last + 1) {
                match w.to_lowercase().as_str() {
                    "c" | "с" => {
                        out.word("цельсия");
                        used += 1;
                    }
                    "f" => {
                        out.word("фаренгейта");
                        used += 1;
                    }
                    _ => {}
                }
            }
        }
        Some(used)
    }
}

fn next_significant(toks: &[Tok], from: usize) -> Option<usize> {
    let mut j = from;
    while j < toks.len() {
        if toks[j] != Tok::Space {
            return Some(j);
        }
        j += 1;
    }
    None
}

fn unit_at(toks: &[Tok], j: usize) -> Option<(&'static nouns::Unit, usize)> {
    let name = match &toks[j] {
        Tok::Sym(c @ ('%' | '°' | '₽' | '$' | '€')) => c.to_string(),
        Tok::Word(w) => w.to_lowercase(),
        _ => return None,
    };
    if matches!(name.as_str(), "с" | "р" | "м") && matches!(toks.get(j + 1), Some(Tok::Word(_))) {
        return None;
    }
    let unit = nouns::unit(&name)?;
    let mut last = j;
    if matches!(toks.get(j + 1), Some(Tok::Sym('.'))) && name.chars().all(|c| c.is_alphabetic()) && name.chars().count() > 1 {
        let after = toks.get(j + 2);
        if !matches!(after, Some(Tok::Word(_))) {
            last = j + 1;
        }
    }
    Some((unit, last))
}

fn following_gender(toks: &[Tok], from: usize) -> Option<Gender> {
    let mut seen = 0;
    let mut first_guess = None;
    let mut j = from;
    while j < toks.len() && seen < 2 {
        match &toks[j] {
            Tok::Space => {}
            Tok::Word(w) => {
                let w = w.to_lowercase();
                if let Some(g) = nouns::gender_of(&w) {
                    return Some(g);
                }
                if first_guess.is_none() {
                    first_guess = Some(nouns::guess_gender(&w));
                }
                seen += 1;
            }
            _ => break,
        }
        j += 1;
    }
    first_guess
}

fn time_words(h: u64, m: u64) -> Vec<String> {
    let mut words = cardinal(h, Case::Nom, Gender::M);
    if m == 0 {
        let hour_word = match count_class(h) {
            0 => "час",
            1 => "часа",
            _ => "часов",
        };
        words.push(hour_word.to_string());
        return words;
    }
    if m < 10 {
        words.push("ноль".to_string());
    }
    words.extend(cardinal(m, Case::Nom, Gender::M));
    words
}

fn date_words(d: u64, m: u64, y: u64, case: Case) -> Vec<String> {
    let day_case = match case {
        Case::Acc => Case::Nom,
        c => c,
    };
    let mut words = ordinal(d, day_case, Gender::N);
    words.push(MONTHS_GEN[(m - 1) as usize].to_string());
    words.extend(ordinal(y, Case::Gen, Gender::M));
    words.push("года".to_string());
    words
}
