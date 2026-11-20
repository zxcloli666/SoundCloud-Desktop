#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Case {
    Nom,
    Gen,
    Dat,
    Acc,
    Ins,
    Pre,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Gender {
    M,
    F,
    N,
    P,
}

type Forms = [&'static str; 6];

const ZERO: Forms = ["ноль", "ноля", "нолю", "ноль", "нолём", "ноле"];

const ONE_M: Forms = ["один", "одного", "одному", "один", "одним", "одном"];
const ONE_F: Forms = ["одна", "одной", "одной", "одну", "одной", "одной"];
const ONE_N: Forms = ["одно", "одного", "одному", "одно", "одним", "одном"];
const TWO_M: Forms = ["два", "двух", "двум", "два", "двумя", "двух"];
const TWO_F: Forms = ["две", "двух", "двум", "две", "двумя", "двух"];

const UNITS: [Forms; 8] = [
    ["три", "трёх", "трём", "три", "тремя", "трёх"],
    ["четыре", "четырёх", "четырём", "четыре", "четырьмя", "четырёх"],
    ["пять", "пяти", "пяти", "пять", "пятью", "пяти"],
    ["шесть", "шести", "шести", "шесть", "шестью", "шести"],
    ["семь", "семи", "семи", "семь", "семью", "семи"],
    ["восемь", "восьми", "восьми", "восемь", "восемью", "восьми"],
    ["девять", "девяти", "девяти", "девять", "девятью", "девяти"],
    ["десять", "десяти", "десяти", "десять", "десятью", "десяти"],
];

const TEENS: [Forms; 9] = [
    [
        "одиннадцать",
        "одиннадцати",
        "одиннадцати",
        "одиннадцать",
        "одиннадцатью",
        "одиннадцати",
    ],
    [
        "двенадцать",
        "двенадцати",
        "двенадцати",
        "двенадцать",
        "двенадцатью",
        "двенадцати",
    ],
    [
        "тринадцать",
        "тринадцати",
        "тринадцати",
        "тринадцать",
        "тринадцатью",
        "тринадцати",
    ],
    [
        "четырнадцать",
        "четырнадцати",
        "четырнадцати",
        "четырнадцать",
        "четырнадцатью",
        "четырнадцати",
    ],
    [
        "пятнадцать",
        "пятнадцати",
        "пятнадцати",
        "пятнадцать",
        "пятнадцатью",
        "пятнадцати",
    ],
    [
        "шестнадцать",
        "шестнадцати",
        "шестнадцати",
        "шестнадцать",
        "шестнадцатью",
        "шестнадцати",
    ],
    [
        "семнадцать",
        "семнадцати",
        "семнадцати",
        "семнадцать",
        "семнадцатью",
        "семнадцати",
    ],
    [
        "восемнадцать",
        "восемнадцати",
        "восемнадцати",
        "восемнадцать",
        "восемнадцатью",
        "восемнадцати",
    ],
    [
        "девятнадцать",
        "девятнадцати",
        "девятнадцати",
        "девятнадцать",
        "девятнадцатью",
        "девятнадцати",
    ],
];

const TENS: [Forms; 8] = [
    [
        "двадцать",
        "двадцати",
        "двадцати",
        "двадцать",
        "двадцатью",
        "двадцати",
    ],
    [
        "тридцать",
        "тридцати",
        "тридцати",
        "тридцать",
        "тридцатью",
        "тридцати",
    ],
    ["сорок", "сорока", "сорока", "сорок", "сорока", "сорока"],
    [
        "пятьдесят",
        "пятидесяти",
        "пятидесяти",
        "пятьдесят",
        "пятьюдесятью",
        "пятидесяти",
    ],
    [
        "шестьдесят",
        "шестидесяти",
        "шестидесяти",
        "шестьдесят",
        "шестьюдесятью",
        "шестидесяти",
    ],
    [
        "семьдесят",
        "семидесяти",
        "семидесяти",
        "семьдесят",
        "семьюдесятью",
        "семидесяти",
    ],
    [
        "восемьдесят",
        "восьмидесяти",
        "восьмидесяти",
        "восемьдесят",
        "восьмьюдесятью",
        "восьмидесяти",
    ],
    [
        "девяносто",
        "девяноста",
        "девяноста",
        "девяносто",
        "девяноста",
        "девяноста",
    ],
];

const HUNDREDS: [Forms; 9] = [
    ["сто", "ста", "ста", "сто", "ста", "ста"],
    ["двести", "двухсот", "двумстам", "двести", "двумястами", "двухстах"],
    ["триста", "трёхсот", "трёмстам", "триста", "тремястами", "трёхстах"],
    [
        "четыреста",
        "четырёхсот",
        "четырёмстам",
        "четыреста",
        "четырьмястами",
        "четырёхстах",
    ],
    ["пятьсот", "пятисот", "пятистам", "пятьсот", "пятьюстами", "пятистах"],
    [
        "шестьсот",
        "шестисот",
        "шестистам",
        "шестьсот",
        "шестьюстами",
        "шестистах",
    ],
    ["семьсот", "семисот", "семистам", "семьсот", "семьюстами", "семистах"],
    [
        "восемьсот",
        "восьмисот",
        "восьмистам",
        "восемьсот",
        "восьмьюстами",
        "восьмистах",
    ],
    [
        "девятьсот",
        "девятисот",
        "девятистам",
        "девятьсот",
        "девятьюстами",
        "девятистах",
    ],
];

struct Scale {
    one: Forms,
    many: Forms,
    feminine: bool,
}

const SCALES: [Scale; 4] = [
    Scale {
        one: ["", "", "", "", "", ""],
        many: ["", "", "", "", "", ""],
        feminine: false,
    },
    Scale {
        one: ["тысяча", "тысячи", "тысяче", "тысячу", "тысячей", "тысяче"],
        many: ["тысячи", "тысяч", "тысячам", "тысячи", "тысячами", "тысячах"],
        feminine: true,
    },
    Scale {
        one: [
            "миллион",
            "миллиона",
            "миллиону",
            "миллион",
            "миллионом",
            "миллионе",
        ],
        many: [
            "миллионы",
            "миллионов",
            "миллионам",
            "миллионы",
            "миллионами",
            "миллионах",
        ],
        feminine: false,
    },
    Scale {
        one: [
            "миллиард",
            "миллиарда",
            "миллиарду",
            "миллиард",
            "миллиардом",
            "миллиарде",
        ],
        many: [
            "миллиарды",
            "миллиардов",
            "миллиардам",
            "миллиарды",
            "миллиардами",
            "миллиардах",
        ],
        feminine: false,
    },
];

fn idx(case: Case) -> usize {
    case as usize
}

fn units(d: u64, case: Case, gender: Gender) -> &'static str {
    let c = idx(case);
    match d {
        1 => match gender {
            Gender::F => ONE_F[c],
            Gender::N => ONE_N[c],
            _ => ONE_M[c],
        },
        2 => match gender {
            Gender::F => TWO_F[c],
            _ => TWO_M[c],
        },
        _ => UNITS[(d - 3) as usize][c],
    }
}

fn group(n: u64, case: Case, gender: Gender, out: &mut Vec<String>) {
    let c = idx(case);
    let h = n / 100;
    let rest = n % 100;
    if h > 0 {
        out.push(HUNDREDS[(h - 1) as usize][c].to_string());
    }
    if rest >= 20 {
        out.push(TENS[(rest / 10 - 2) as usize][c].to_string());
        if rest % 10 > 0 {
            out.push(units(rest % 10, case, gender).to_string());
        }
    } else if rest > 10 {
        out.push(TEENS[(rest - 11) as usize][c].to_string());
    } else if rest == 10 {
        out.push(UNITS[7][c].to_string());
    } else if rest > 0 {
        out.push(units(rest, case, gender).to_string());
    }
}

fn scale_word(count: u64, scale: &Scale, case: Case) -> &'static str {
    let c = idx(case);
    let last = count % 10;
    let teen = count % 100 / 10 == 1;
    let nominative = matches!(case, Case::Nom | Case::Acc);
    if last == 1 && !teen {
        scale.one[c]
    } else if nominative && (2..=4).contains(&last) && !teen {
        scale.one[1]
    } else if nominative {
        scale.many[1]
    } else {
        scale.many[c]
    }
}

pub fn cardinal(n: u64, case: Case, gender: Gender) -> Vec<String> {
    let mut out = Vec::new();
    if n == 0 {
        out.push(ZERO[idx(case)].to_string());
        return out;
    }
    let mut groups = Vec::new();
    let mut rest = n;
    while rest > 0 {
        groups.push(rest % 1000);
        rest /= 1000;
    }
    for pos in (0..groups.len()).rev() {
        let value = groups[pos];
        if value == 0 {
            continue;
        }
        if pos == 0 {
            group(value, case, gender, &mut out);
        } else if pos < SCALES.len() {
            let scale = &SCALES[pos];
            let g = if scale.feminine { Gender::F } else { Gender::M };
            if !(value == 1 && pos == 1 && groups.len() == 2) {
                group(value, case, g, &mut out);
            }
            out.push(scale_word(value, scale, case).to_string());
        } else {
            group(value, case, Gender::M, &mut out);
        }
    }
    out
}

const ORD_ENDINGS: [[&str; 6]; 4] = [
    ["", "ого", "ому", "", "ым", "ом"],
    ["ая", "ой", "ой", "ую", "ой", "ой"],
    ["ое", "ого", "ому", "ое", "ым", "ом"],
    ["ые", "ых", "ым", "ые", "ыми", "ых"],
];

const THIRD: [[&str; 6]; 4] = [
    ["третий", "третьего", "третьему", "третий", "третьим", "третьем"],
    ["третья", "третьей", "третьей", "третью", "третьей", "третьей"],
    ["третье", "третьего", "третьему", "третье", "третьим", "третьем"],
    ["третьи", "третьих", "третьим", "третьи", "третьими", "третьих"],
];

fn ordinal_word(stem: &str, nominative: &str, case: Case, gender: Gender) -> String {
    let g = gender as usize;
    let c = idx(case);
    if g == 0 && matches!(case, Case::Nom | Case::Acc) {
        return format!("{stem}{nominative}");
    }
    format!("{stem}{}", ORD_ENDINGS[g][c])
}

const ORD_SMALL: [(&str, &str); 19] = [
    ("перв", "ый"),
    ("втор", "ой"),
    ("", ""),
    ("четвёрт", "ый"),
    ("пят", "ый"),
    ("шест", "ой"),
    ("седьм", "ой"),
    ("восьм", "ой"),
    ("девят", "ый"),
    ("десят", "ый"),
    ("одиннадцат", "ый"),
    ("двенадцат", "ый"),
    ("тринадцат", "ый"),
    ("четырнадцат", "ый"),
    ("пятнадцат", "ый"),
    ("шестнадцат", "ый"),
    ("семнадцат", "ый"),
    ("восемнадцат", "ый"),
    ("девятнадцат", "ый"),
];

const ORD_TENS: [(&str, &str); 8] = [
    ("двадцат", "ый"),
    ("тридцат", "ый"),
    ("сороков", "ой"),
    ("пятидесят", "ый"),
    ("шестидесят", "ый"),
    ("семидесят", "ый"),
    ("восьмидесят", "ый"),
    ("девяност", "ый"),
];

const ORD_HUNDREDS: [(&str, &str); 9] = [
    ("сот", "ый"),
    ("двухсот", "ый"),
    ("трёхсот", "ый"),
    ("четырёхсот", "ый"),
    ("пятисот", "ый"),
    ("шестисот", "ый"),
    ("семисот", "ый"),
    ("восьмисот", "ый"),
    ("девятисот", "ый"),
];

const THOUSAND_PREFIX: [&str; 10] = [
    "", "", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти",
];

fn ordinal_small(n: u64, case: Case, gender: Gender) -> String {
    if n == 3 {
        return THIRD[gender as usize][idx(case)].to_string();
    }
    let (stem, ending) = ORD_SMALL[(n - 1) as usize];
    ordinal_word(stem, ending, case, gender)
}

fn ordinal_below_thousand(n: u64, case: Case, gender: Gender, out: &mut Vec<String>) {
    let h = n / 100;
    let rest = n % 100;
    if rest == 0 {
        let (stem, ending) = ORD_HUNDREDS[(h - 1) as usize];
        out.push(ordinal_word(stem, ending, case, gender));
        return;
    }
    if h > 0 {
        out.push(HUNDREDS[(h - 1) as usize][0].to_string());
    }
    if rest < 20 {
        out.push(ordinal_small(rest, case, gender));
    } else if rest % 10 == 0 {
        let (stem, ending) = ORD_TENS[(rest / 10 - 2) as usize];
        out.push(ordinal_word(stem, ending, case, gender));
    } else {
        out.push(TENS[(rest / 10 - 2) as usize][0].to_string());
        out.push(ordinal_small(rest % 10, case, gender));
    }
}

pub fn ordinal(n: u64, case: Case, gender: Gender) -> Vec<String> {
    let mut out = Vec::new();
    if n == 0 {
        out.push(ordinal_word("нулев", "ой", case, gender));
        return out;
    }
    if n % 1000 != 0 {
        let high = n - n % 1000;
        if high > 0 {
            out.extend(cardinal(high, Case::Nom, Gender::M));
        }
        ordinal_below_thousand(n % 1000, case, gender, &mut out);
        return out;
    }
    let thousands = n / 1000;
    if thousands < 10 {
        let prefix = THOUSAND_PREFIX[thousands as usize];
        out.push(ordinal_word(&format!("{prefix}тысячн"), "ый", case, gender));
    } else {
        out.extend(cardinal(n - 1000, Case::Nom, Gender::M));
        out.push(ordinal_word("тысячн", "ый", case, gender));
    }
    out
}
