use super::{is_number, value};
use crate::lexicon::{MIN_UNITS, SEC_UNITS};

const SLANG_NUMBERS: &[(&str, u32)] = &[
    ("четверть", 25),
    ("треть", 33),
    ("полтос", 50),
    ("полста", 50),
    ("тридцатник", 30),
    ("двадцатник", 20),
    ("полтинник", 50),
    ("полтинника", 50),
    ("сотка", 100),
    ("сотку", 100),
    ("сотню", 100),
    ("соточка", 100),
    ("соточку", 100),
    ("полтосик", 50),
    ("полтинничек", 50),
    ("тридцаточку", 30),
    ("двадцаточку", 20),
    ("пятнашку", 15),
    ("тридцатка", 30),
    ("тридцатку", 30),
    ("двадцатка", 20),
    ("двадцатку", 20),
    ("десятка", 10),
    ("десятку", 10),
    ("десяточку", 10),
    ("пару", 2),
    ("двоечку", 20),
    ("троечку", 30),
    ("четверочку", 40),
    ("пятерочку", 50),
    ("шестерочку", 60),
    ("семерочку", 70),
    ("восьмерочку", 80),
    ("девяточку", 90),
];

const ORDINALS: &[(&str, u32)] = &[
    ("первую", 1),
    ("первой", 1),
    ("вторую", 2),
    ("второй", 2),
    ("третью", 3),
    ("третьей", 3),
    ("пятую", 5),
    ("пятой", 5),
    ("десятую", 10),
    ("десятой", 10),
    ("двадцатую", 20),
    ("двадцатой", 20),
    ("тридцатую", 30),
    ("тридцатой", 30),
    ("сороковую", 40),
    ("сороковой", 40),
    ("пятидесятую", 50),
    ("пятидесятой", 50),
    ("одиннадцатый", 11),
    ("двенадцатый", 12),
    ("тринадцатый", 13),
    ("четырнадцатый", 14),
    ("пятнадцатый", 15),
    ("шестнадцатый", 16),
    ("семнадцатый", 17),
    ("восемнадцатый", 18),
    ("девятнадцатый", 19),
    ("шестидесятую", 60),
    ("шестидесятой", 60),
];

const ORDINAL_STEMS: &[(&str, u32)] = &[
    ("перв", 1),
    ("втор", 2),
    ("четверт", 4),
    ("пят", 5),
    ("шест", 6),
    ("седьм", 7),
    ("восьм", 8),
    ("девят", 9),
    ("десят", 10),
    ("одиннадцат", 11),
    ("двенадцат", 12),
    ("тринадцат", 13),
    ("четырнадцат", 14),
    ("пятнадцат", 15),
    ("шестнадцат", 16),
    ("семнадцат", 17),
    ("восемнадцат", 18),
    ("девятнадцат", 19),
    ("двадцат", 20),
    ("тридцат", 30),
    ("сороков", 40),
    ("пятидесят", 50),
    ("шестидесят", 60),
    ("семидесят", 70),
    ("восьмидесят", 80),
    ("девяност", 90),
    ("сот", 100),
];

const ORDINAL_ENDINGS: &[&str] = &["ую", "ой"];

const WRITTEN_ORDINAL_ENDINGS: &[&str] = &["й", "ю", "ую"];

pub fn colloquial(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let w = words[i].as_str();
        let next = words.get(i + 1).map(String::as_str).unwrap_or("");
        let after = words.get(i + 2).map(String::as_str).unwrap_or("");
        if is_number(w) && WRITTEN_ORDINAL_ENDINGS.contains(&next) && time_unit(after) {
            out.push(words[i].clone());
            out.push("ордин".into());
            i += 2;
            continue;
        }
        match (w, next) {
            ("три", "четверти") => {
                out.push("75".into());
                out.push("доля".into());
                i += 2;
                continue;
            }
            ("две", "трети") => {
                out.push("66".into());
                out.push("доля".into());
                i += 2;
                continue;
            }
            _ => {}
        }
        if let Some((_, v)) = SLANG_NUMBERS.iter().find(|(k, _)| *k == w) {
            out.push(v.to_string());
            if matches!(w, "четверть" | "треть") {
                out.push("доля".into());
            }
        } else if let Some(v) = ordinal(w, next) {
            out.push(v.to_string());
            out.push("ордин".into());
        } else {
            out.push(words[i].clone());
        }
        i += 1;
    }
    out
}

fn ordinal(w: &str, next: &str) -> Option<u32> {
    let listed = ORDINALS.iter().find(|(k, _)| *k == w).map(|(_, v)| *v);
    listed.or_else(|| counting(w).filter(|_| time_unit(next)))
}

fn counting(w: &str) -> Option<u32> {
    let said = |stem: &str| {
        w.strip_prefix(stem)
            .is_some_and(|end| ORDINAL_ENDINGS.contains(&end))
    };
    ORDINAL_STEMS
        .iter()
        .find(|(stem, _)| said(stem))
        .map(|(_, v)| *v)
}

fn time_unit(w: &str) -> bool {
    SEC_UNITS.contains(&w) || MIN_UNITS.contains(&w)
}

pub fn out_of_ten(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let scale = words.get(i + 1).is_some_and(|w| w == "из")
            && words.get(i + 2).is_some_and(|w| w == "10");
        match (scale, value(&words[i])) {
            (true, Some(n)) => {
                out.push((n * 10).to_string());
                i += 3;
            }
            _ => {
                out.push(words[i].clone());
                i += 1;
            }
        }
    }
    out
}
