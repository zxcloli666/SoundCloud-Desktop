const ONES: [&str; 20] = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen",
];

const TENS: [&str; 10] = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

const SCALES: [&str; 4] = ["", "thousand", "million", "billion"];

fn below_thousand(n: u64, out: &mut Vec<String>) {
    let h = n / 100;
    let rest = n % 100;
    if h > 0 {
        out.push(ONES[h as usize].to_string());
        out.push("hundred".to_string());
    }
    if rest >= 20 {
        let ten = TENS[(rest / 10) as usize];
        if !rest.is_multiple_of(10) {
            out.push(format!("{}-{}", ten, ONES[(rest % 10) as usize]));
        } else {
            out.push(ten.to_string());
        }
    } else if rest > 0 {
        out.push(ONES[rest as usize].to_string());
    }
}

pub fn cardinal(n: u64) -> Vec<String> {
    if n == 0 {
        return vec!["zero".to_string()];
    }
    let mut groups = Vec::new();
    let mut rest = n;
    while rest > 0 {
        groups.push(rest % 1000);
        rest /= 1000;
    }
    let mut out = Vec::new();
    for pos in (0..groups.len()).rev() {
        if groups[pos] == 0 {
            continue;
        }
        below_thousand(groups[pos], &mut out);
        if pos > 0 && pos < SCALES.len() {
            out.push(SCALES[pos].to_string());
        }
    }
    out
}

fn ordinal_word(word: &str) -> String {
    let (head, last) = match word.rsplit_once('-') {
        Some((h, l)) => (format!("{h}-"), l),
        None => (String::new(), word),
    };
    let ord = match last {
        "one" => "first".to_string(),
        "two" => "second".to_string(),
        "three" => "third".to_string(),
        "five" => "fifth".to_string(),
        "eight" => "eighth".to_string(),
        "nine" => "ninth".to_string(),
        "twelve" => "twelfth".to_string(),
        w if w.ends_with('y') => format!("{}ieth", &w[..w.len() - 1]),
        w => format!("{w}th"),
    };
    format!("{head}{ord}")
}

pub fn ordinal(n: u64) -> Vec<String> {
    let mut words = cardinal(n);
    if let Some(last) = words.pop() {
        words.push(ordinal_word(&last));
    }
    words
}

pub fn year(n: u64) -> Vec<String> {
    if !(1100..=2099).contains(&n) || (2000..=2009).contains(&n) {
        return cardinal(n);
    }
    let (hi, lo) = (n / 100, n % 100);
    let mut out = cardinal(hi);
    match lo {
        0 => out.push("hundred".to_string()),
        1..=9 => {
            out.push("oh".to_string());
            out.push(ONES[lo as usize].to_string());
        }
        _ => below_thousand(lo, &mut out),
    }
    out
}

pub fn digits(text: &str) -> Vec<String> {
    text.chars()
        .filter_map(|c| c.to_digit(10))
        .map(|d| if d == 0 { "zero".to_string() } else { ONES[d as usize].to_string() })
        .collect()
}
