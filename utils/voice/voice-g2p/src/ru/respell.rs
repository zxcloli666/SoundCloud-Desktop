use super::stress::Word;

#[derive(Clone, Copy, Debug)]
pub struct Letter {
    pub c: char,
    pub start: bool,
    pub end: bool,
    pub stressed: bool,
}

const GEN_EXCEPTIONS: &[&str] = &["много", "немного", "строго", "убого", "дорого", "нестрого", "ого", "недорого", "итого", "налого"];

const WHOLE: &[(&str, &str)] = &[
    ("что", "што"),
    ("чтобы", "штобы"),
    ("чтоб", "штоб"),
    ("нечто", "нешто"),
    ("сегодня", "севодня"),
    ("сегодняшний", "севодняшний"),
    ("сегодняшнего", "севодняшнево"),
    ("конечно", "конешно"),
    ("скучно", "скушно"),
    ("нарочно", "нарошно"),
    ("яичница", "яишница"),
    ("скворечник", "скворешник"),
    ("прачечная", "прашечная"),
    ("кое-что", "кое-што"),
    ("что-нибудь", "што-нибудь"),
    ("что-либо", "што-либо"),
    ("что-то", "што-то"),
    ("лестница", "лесница"),
    ("здравствуйте", "здраствуйте"),
    ("здравствуй", "здраствуй"),
];

const CLUSTERS: &[(&str, &str)] = &[
    ("ться", "цца"),
    ("тся", "цца"),
    ("вств", "ств"),
    ("стн", "сн"),
    ("здн", "зн"),
    ("стл", "сл"),
    ("лнц", "нц"),
    ("рдц", "рц"),
    ("нтск", "нск"),
    ("ндск", "нск"),
    ("стск", "ск"),
    ("гк", "хк"),
    ("гч", "хч"),
    ("тс", "ц"),
    ("дц", "ц"),
    ("тц", "цц"),
    ("сч", "щ"),
    ("зч", "щ"),
    ("жч", "щ"),
    ("тч", "чч"),
    ("дч", "чч"),
];

fn replace(letters: &mut Vec<Letter>, from: &str, to: &str) {
    let from: Vec<char> = from.chars().collect();
    let to: Vec<char> = to.chars().collect();
    let mut i = 0;
    while i + from.len() <= letters.len() {
        let window = &letters[i..i + from.len()];
        let same = window.iter().zip(&from).all(|(l, c)| l.c == *c);
        let inside = window.iter().skip(1).all(|l| !l.start);
        if same && inside {
            let first = window[0];
            let last = window[window.len() - 1];
            let stressed = window.iter().any(|l| l.stressed);
            let mut new: Vec<Letter> = to
                .iter()
                .map(|c| Letter { c: *c, start: false, end: false, stressed: false })
                .collect();
            if let Some(f) = new.first_mut() {
                f.start = first.start;
            }
            if let Some(l) = new.last_mut() {
                l.end = last.end;
            }
            if stressed {
                if let Some(pos) = new.iter().position(|l| "аеёиоуыэюя".contains(l.c)) {
                    new[pos].stressed = true;
                }
            }
            let n = new.len();
            letters.splice(i..i + from.len(), new);
            i += n;
        } else {
            i += 1;
        }
    }
}

pub fn letters_of(word: &Word) -> Vec<Letter> {
    let n = word.letters.len();
    word.letters
        .iter()
        .enumerate()
        .filter(|(_, c)| **c != '-')
        .map(|(i, c)| Letter {
            c: *c,
            start: i == 0,
            end: i + 1 == n,
            stressed: word.stress == Some(i),
        })
        .collect()
}

pub fn respell(word: &Word) -> Vec<Letter> {
    let mut letters = letters_of(word);
    let text: String = word.letters.iter().collect();
    if let Some((_, to)) = WHOLE.iter().find(|(from, _)| *from == text) {
        let stress_vowel_rank = word
            .stress
            .map(|s| word.letters[..s].iter().filter(|c| "аеёиоуыэюя".contains(**c)).count());
        let mut new: Vec<Letter> = to
            .chars()
            .filter(|c| *c != '-')
            .map(|c| Letter { c, start: false, end: false, stressed: false })
            .collect();
        new[0].start = true;
        let last = new.len() - 1;
        new[last].end = true;
        if let Some(rank) = stress_vowel_rank {
            let mut seen = 0;
            for l in new.iter_mut() {
                if "аеёиоуыэюя".contains(l.c) {
                    if seen == rank {
                        l.stressed = true;
                    }
                    seen += 1;
                }
            }
        }
        return finish(new);
    }
    let long_enough = word.letters.len() >= 4 || matches!(text.as_str(), "его" | "того" | "кого" | "чего" | "него");
    if (text.ends_with("ого") || text.ends_with("его")) && long_enough && !GEN_EXCEPTIONS.contains(&text.as_str()) {
        let n = letters.len();
        if n >= 3 {
            letters[n - 2].c = 'в';
        }
    }
    for (from, to) in CLUSTERS {
        replace(&mut letters, from, to);
    }
    finish(letters)
}

fn finish(mut letters: Vec<Letter>) -> Vec<Letter> {
    if let Some(f) = letters.first_mut() {
        f.start = true;
    }
    if let Some(l) = letters.last_mut() {
        l.end = true;
    }
    letters
}
