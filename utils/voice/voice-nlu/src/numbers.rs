#[derive(Clone, Copy)]
enum Word {
    Unit(u32),
    Teen(u32),
    Ten(u32),
    Hundred(u32),
    Thousand,
    Zero,
}

fn word(w: &str) -> Option<Word> {
    let v = match w {
        "ноль" | "нуль" | "ноля" | "нуля" | "zero" => return Some(Word::Zero),
        "один" | "одна" | "одно" | "одну" | "одного" | "одной" | "one" => {
            Word::Unit(1)
        }
        "два" | "две" | "двух" | "two" => Word::Unit(2),
        "три" | "трех" | "three" => Word::Unit(3),
        "четыре" | "четырех" | "four" => Word::Unit(4),
        "пять" | "пяти" | "five" => Word::Unit(5),
        "шесть" | "шести" | "six" => Word::Unit(6),
        "семь" | "семи" | "seven" => Word::Unit(7),
        "восемь" | "восьми" | "eight" => Word::Unit(8),
        "девять" | "девяти" | "nine" => Word::Unit(9),
        "десять" | "десяти" | "ten" => Word::Teen(10),
        "одиннадцать" | "eleven" => Word::Teen(11),
        "двенадцать" | "twelve" => Word::Teen(12),
        "тринадцать" | "thirteen" => Word::Teen(13),
        "четырнадцать" | "fourteen" => Word::Teen(14),
        "пятнадцать" | "fifteen" => Word::Teen(15),
        "шестнадцать" | "sixteen" => Word::Teen(16),
        "семнадцать" | "seventeen" => Word::Teen(17),
        "восемнадцать" | "eighteen" => Word::Teen(18),
        "девятнадцать" | "nineteen" => Word::Teen(19),
        "двадцать" | "двадцати" | "twenty" => Word::Ten(20),
        "тридцать" | "тридцати" | "thirty" => Word::Ten(30),
        "сорок" | "сорока" | "forty" => Word::Ten(40),
        "пятьдесят" | "пятидесяти" | "fifty" => Word::Ten(50),
        "шестьдесят" | "шестидесяти" | "sixty" => Word::Ten(60),
        "семьдесят" | "семидесяти" | "seventy" => Word::Ten(70),
        "восемьдесят" | "восьмидесяти" | "eighty" => Word::Ten(80),
        "девяносто" | "девяноста" | "ninety" => Word::Ten(90),
        "сто" | "ста" | "hundred" => Word::Hundred(100),
        "двести" | "двухсот" => Word::Hundred(200),
        "триста" | "трехсот" => Word::Hundred(300),
        "четыреста" | "четырехсот" => Word::Hundred(400),
        "пятьсот" | "пятисот" => Word::Hundred(500),
        "шестьсот" | "шестисот" => Word::Hundred(600),
        "семьсот" | "семисот" => Word::Hundred(700),
        "восемьсот" | "восьмисот" => Word::Hundred(800),
        "девятьсот" | "девятисот" => Word::Hundred(900),
        "тысяча" | "тысячу" | "тысячи" | "тысяч" | "thousand" => {
            Word::Thousand
        }
        _ => return None,
    };
    Some(v)
}

fn spelled_english(w: &str) -> Option<u32> {
    match w {
        "ван" => Some(1),
        "ту" => Some(2),
        "фри" => Some(3),
        "фор" => Some(4),
        "файв" => Some(5),
        "сикс" => Some(6),
        "севен" => Some(7),
        "эйт" => Some(8),
        "найн" => Some(9),
        "тен" => Some(10),
        "твенти" => Some(20),
        "сёрти" | "тёрти" | "серти" | "терти" => Some(30),
        "форти" => Some(40),
        "фифти" => Some(50),
        "сиксти" => Some(60),
        "севенти" => Some(70),
        "эйти" => Some(80),
        "найнти" => Some(90),
        _ => None,
    }
}

struct Acc {
    total: u32,
    cur: u32,
    open: bool,
}

impl Acc {
    fn new() -> Acc {
        Acc {
            total: 0,
            cur: 0,
            open: false,
        }
    }

    fn accept(&mut self, w: Word) -> bool {
        let tail = self.cur % 100;
        let ok = match w {
            Word::Zero => !self.open,
            Word::Unit(_) => tail == 0 || (tail >= 20 && tail % 10 == 0),
            Word::Teen(_) | Word::Ten(_) => tail == 0,
            Word::Hundred(_) => self.cur == 0,
            Word::Thousand => self.cur > 0 || !self.open,
        };
        if !ok {
            return false;
        }
        match w {
            Word::Zero => {}
            Word::Unit(n) | Word::Teen(n) | Word::Ten(n) | Word::Hundred(n) => self.cur += n,
            Word::Thousand => {
                self.total += self.cur.max(1) * 1000;
                self.cur = 0;
            }
        }
        self.open = true;
        true
    }

    fn value(&self) -> u32 {
        self.total + self.cur
    }
}

pub fn merge(tokens: &[String], spelled: bool) -> Vec<String> {
    let mut out = Vec::new();
    let mut acc = Acc::new();
    for t in tokens {
        let w = word(t).or_else(|| {
            if spelled {
                spelled_english(t).map(|n| {
                    if n >= 20 {
                        Word::Ten(n)
                    } else if n >= 10 {
                        Word::Teen(n)
                    } else {
                        Word::Unit(n)
                    }
                })
            } else {
                None
            }
        });
        match w {
            Some(w) => {
                if !acc.accept(w) {
                    out.push(acc.value().to_string());
                    acc = Acc::new();
                    acc.accept(w);
                }
            }
            None => {
                if acc.open {
                    out.push(acc.value().to_string());
                    acc = Acc::new();
                }
                out.push(t.clone());
            }
        }
    }
    if acc.open {
        out.push(acc.value().to_string());
    }
    out
}

pub fn is_number(w: &str) -> bool {
    !w.is_empty() && w.chars().all(|c| c.is_ascii_digit())
}

pub fn value(w: &str) -> Option<u32> {
    if is_number(w) { w.parse().ok() } else { None }
}

pub fn clock(w: &str) -> Option<u32> {
    if !w.contains(':') {
        return None;
    }
    let mut total = 0;
    for part in w.split(':') {
        total = total * 60 + part.parse::<u32>().ok()?;
    }
    Some(total)
}

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

pub fn colloquial(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let w = words[i].as_str();
        let next = words.get(i + 1).map(String::as_str).unwrap_or("");
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
        } else if let Some((_, v)) = ORDINALS.iter().find(|(k, _)| *k == w) {
            out.push(v.to_string());
            out.push("ордин".into());
        } else {
            out.push(words[i].clone());
        }
        i += 1;
    }
    out
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
