use super::numbers;

#[derive(Debug, PartialEq)]
pub enum Piece {
    Word(String),
    Punct(char),
}

fn push_words(out: &mut Vec<Piece>, words: Vec<String>) {
    for w in words {
        for part in w.split('-') {
            out.push(Piece::Word(part.to_string()));
        }
    }
}

fn number_words(int: &str, frac: Option<&str>, suffix: &str) -> Vec<String> {
    let value: u64 = int.parse().unwrap_or(0);
    if int.len() > 12 || (int.len() > 1 && int.starts_with('0') && frac.is_none()) {
        return numbers::digits(int);
    }
    if !suffix.is_empty() && frac.is_none() {
        return numbers::ordinal(value);
    }
    let mut words = if int.len() == 4 && (1100..=2099).contains(&value) && frac.is_none() {
        numbers::year(value)
    } else {
        numbers::cardinal(value)
    };
    if let Some(f) = frac {
        words.push("point".to_string());
        words.extend(numbers::digits(f));
    }
    words
}

pub fn pieces(text: &str) -> Vec<Piece> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_ascii_digit() {
            let mut j = i;
            while j < chars.len() && (chars[j].is_ascii_digit() || (chars[j] == ',' && chars.get(j + 1).is_some_and(|d| d.is_ascii_digit()) && chars.get(j + 3).is_some_and(|d| !d.is_ascii_digit()) && j > i)) {
                j += 1;
            }
            let int: String = chars[i..j].iter().filter(|c| **c != ',').collect();
            if chars.get(j) == Some(&':') && chars.get(j + 1).is_some_and(|d| d.is_ascii_digit()) && int.len() <= 2 {
                let mut k = j + 1;
                while k < chars.len() && chars[k].is_ascii_digit() {
                    k += 1;
                }
                let minutes: String = chars[j + 1..k].iter().collect();
                push_words(&mut out, numbers::cardinal(int.parse().unwrap_or(0)));
                let m: u64 = minutes.parse().unwrap_or(0);
                if m == 0 {
                    out.push(Piece::Word("o'clock".to_string()));
                } else {
                    if m < 10 {
                        out.push(Piece::Word("oh".to_string()));
                    }
                    push_words(&mut out, numbers::cardinal(m));
                }
                i = k;
                continue;
            }
            let mut frac = None;
            if chars.get(j) == Some(&'.') && chars.get(j + 1).is_some_and(|d| d.is_ascii_digit()) {
                let mut k = j + 1;
                while k < chars.len() && chars[k].is_ascii_digit() {
                    k += 1;
                }
                frac = Some(chars[j + 1..k].iter().collect::<String>());
                j = k;
            }
            let mut suffix = String::new();
            let mut k = j;
            while k < chars.len() && chars[k].is_ascii_alphabetic() && k - j < 2 {
                suffix.push(chars[k].to_ascii_lowercase());
                k += 1;
            }
            let is_ordinal = matches!(suffix.as_str(), "st" | "nd" | "rd" | "th")
                && !chars.get(k).is_some_and(|c| c.is_ascii_alphabetic());
            if is_ordinal {
                j = k;
            } else {
                suffix.clear();
            }
            push_words(&mut out, number_words(&int, frac.as_deref(), &suffix));
            match chars.get(j) {
                Some('%') => {
                    out.push(Piece::Word("percent".to_string()));
                    j += 1;
                }
                Some('°') => {
                    out.push(Piece::Word("degrees".to_string()));
                    j += 1;
                }
                _ => {}
            }
            i = j;
        } else if c == '$' && chars.get(i + 1).is_some_and(|d| d.is_ascii_digit()) {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_ascii_digit() {
                j += 1;
            }
            let value: u64 = chars[i + 1..j].iter().collect::<String>().parse().unwrap_or(0);
            push_words(&mut out, numbers::cardinal(value));
            out.push(Piece::Word(if value == 1 { "dollar" } else { "dollars" }.to_string()));
            i = j;
        } else if c.is_ascii_alphabetic() {
            let mut j = i;
            while j < chars.len() {
                let ch = chars[j];
                let inner = (ch == '\'' || ch == '’' || ch == '-')
                    && j > i
                    && chars.get(j + 1).is_some_and(|n| n.is_ascii_alphabetic());
                if ch.is_ascii_alphabetic() || inner {
                    j += 1;
                } else {
                    break;
                }
            }
            let word: String = chars[i..j].iter().map(|c| if *c == '’' { '\'' } else { *c }).collect();
            out.push(Piece::Word(word));
            i = j;
        } else {
            match c {
                ',' | '.' | '!' | '?' | ';' | ':' | '…' => out.push(Piece::Punct(c)),
                '—' | '–' => out.push(Piece::Punct('—')),
                '&' => out.push(Piece::Word("and".to_string())),
                '%' => out.push(Piece::Word("percent".to_string())),
                '(' | ')' => out.push(Piece::Punct(',')),
                _ => {}
            }
            i += 1;
        }
    }
    out
}
