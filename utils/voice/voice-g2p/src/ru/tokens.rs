#[derive(Clone, Debug, PartialEq)]
pub enum Tok {
    Word(String),
    Num(Number),
    Time(u64, u64),
    Date(u64, u64, u64),
    Sym(char),
    Space,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Number {
    pub int: String,
    pub frac: Option<String>,
    pub suffix: Option<String>,
}

fn is_cyr(c: char) -> bool {
    ('а'..='я').contains(&c) || ('А'..='Я').contains(&c) || c == 'ё' || c == 'Ё'
}

fn is_letter(c: char) -> bool {
    c.is_ascii_alphabetic() || is_cyr(c)
}

fn digits(chars: &[char], from: usize) -> usize {
    let mut i = from;
    while i < chars.len() && chars[i].is_ascii_digit() {
        i += 1;
    }
    i
}

fn num_at(chars: &[char], i: usize) -> Option<(u64, usize)> {
    let end = digits(chars, i);
    if end == i || end - i > 4 {
        return None;
    }
    let value = chars[i..end].iter().collect::<String>().parse().ok()?;
    Some((value, end))
}

fn date_at(chars: &[char], i: usize) -> Option<(Tok, usize)> {
    let (d, a) = num_at(chars, i)?;
    if chars.get(a) != Some(&'.') {
        return None;
    }
    let (m, b) = num_at(chars, a + 1)?;
    if chars.get(b) != Some(&'.') {
        return None;
    }
    let (y, c) = num_at(chars, b + 1)?;
    let year_digits = c - (b + 1);
    if year_digits != 4 && year_digits != 2 {
        return None;
    }
    if !(1..=31).contains(&d) || !(1..=12).contains(&m) {
        return None;
    }
    let y = if year_digits == 2 { 2000 + y } else { y };
    Some((Tok::Date(d, m, y), c))
}

fn time_at(chars: &[char], i: usize) -> Option<(Tok, usize)> {
    let (h, a) = num_at(chars, i)?;
    if chars.get(a) != Some(&':') || a - i > 2 {
        return None;
    }
    let end = digits(chars, a + 1);
    if end - (a + 1) != 2 {
        return None;
    }
    let m: u64 = chars[a + 1..end].iter().collect::<String>().parse().ok()?;
    if h > 23 || m > 59 || chars.get(end).is_some_and(|c| c.is_ascii_digit()) {
        return None;
    }
    Some((Tok::Time(h, m), end))
}

fn number_at(chars: &[char], i: usize) -> (Tok, usize) {
    let mut end = digits(chars, i);
    let mut int: String = chars[i..end].iter().collect();
    let grouped = int.len() <= 3;
    while grouped && int.len() < 12 {
        let sep = matches!(chars.get(end), Some(' ' | '\u{a0}' | '\u{202f}'));
        let group_end = digits(chars, end + 1);
        if !sep || group_end - (end + 1) != 3 {
            break;
        }
        int.extend(&chars[end + 1..group_end]);
        end = group_end;
    }
    let mut frac = None;
    if matches!(chars.get(end), Some('.' | ',')) {
        let f_end = digits(chars, end + 1);
        if f_end > end + 1 && f_end - (end + 1) <= 3 {
            frac = Some(chars[end + 1..f_end].iter().collect());
            end = f_end;
        }
    }
    let mut suffix = None;
    if chars.get(end) == Some(&'-') {
        let mut s_end = end + 1;
        while s_end < chars.len() && is_cyr(chars[s_end]) {
            s_end += 1;
        }
        let len = s_end - (end + 1);
        if (1..=3).contains(&len) && !chars.get(s_end).is_some_and(|c| is_letter(*c)) {
            suffix = Some(chars[end + 1..s_end].iter().collect::<String>().to_lowercase());
            end = s_end;
        }
    }
    (Tok::Num(Number { int, frac, suffix }), end)
}

fn word_at(chars: &[char], i: usize) -> usize {
    let mut j = i;
    while j < chars.len() {
        let c = chars[j];
        let next_letter = chars.get(j + 1).is_some_and(|n| is_letter(*n));
        let prev_letter = j > i && is_letter(chars[j - 1]);
        let joiner = (c == '-' || c == '\'' || c == '’') && prev_letter && next_letter;
        let plus = c == '+' && next_letter && (j == i || prev_letter);
        if is_letter(c) || joiner || plus {
            j += 1;
        } else {
            break;
        }
    }
    j
}

pub fn tokenize(text: &str) -> Vec<Tok> {
    written(text).into_iter().map(|(tok, _)| tok).collect()
}

pub fn written(text: &str) -> Vec<(Tok, String)> {
    let chars: Vec<char> = text.chars().collect();
    let mut out: Vec<(Tok, String)> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let (tok, end) = if c.is_ascii_digit() {
            date_at(&chars, i).or_else(|| time_at(&chars, i)).unwrap_or_else(|| number_at(&chars, i))
        } else if is_letter(c) || (c == '+' && chars.get(i + 1).is_some_and(|n| is_letter(*n)) && !chars.get(i.wrapping_sub(1)).is_some_and(|p| p.is_ascii_digit())) {
            let end = word_at(&chars, i);
            (Tok::Word(chars[i..end].iter().collect()), end)
        } else if c == '\n' || !c.is_whitespace() {
            (Tok::Sym(c), i + 1)
        } else if out.last().is_some_and(|(last, _)| *last == Tok::Space) {
            i += 1;
            continue;
        } else {
            (Tok::Space, i + 1)
        };
        out.push((tok, chars[i..end].iter().collect()));
        i = end;
    }
    out
}
