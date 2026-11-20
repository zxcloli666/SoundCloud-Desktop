use super::data::Data;

pub const VOWELS: &str = "аеёиоуыэюя";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    Marked,
    Yo,
    Single,
    Lexicon,
    Restored,
    Guess,
    Weak,
    NoVowel,
}

#[derive(Clone, Debug)]
pub struct Word {
    pub letters: Vec<char>,
    pub stress: Option<usize>,
    pub source: Source,
    pub alternatives: Vec<usize>,
    pub hyphen: bool,
}

const PROCLITICS: &[&str] = &[
    "в", "во", "к", "ко", "с", "со", "у", "о", "об", "обо", "от", "ото", "до", "на", "за", "по", "из",
    "изо", "над", "надо", "под", "подо", "при", "про", "без", "безо", "для", "не", "ни", "и", "а", "но",
    "да", "перед", "передо",
];

const ENCLITICS: &[&str] = &["же", "ли", "бы", "б", "ль"];

const HYPHEN_SUFFIXES: &[&str] = &["то", "либо", "нибудь", "ка", "таки", "де", "с"];

pub fn is_proclitic(word: &str) -> bool {
    PROCLITICS.contains(&word)
}

pub fn is_enclitic(word: &str) -> bool {
    ENCLITICS.contains(&word)
}

pub fn is_hyphen_suffix(word: &str) -> bool {
    HYPHEN_SUFFIXES.contains(&word)
}

fn vowel_positions(letters: &[char]) -> Vec<usize> {
    letters
        .iter()
        .enumerate()
        .filter(|(_, c)| VOWELS.contains(**c))
        .map(|(i, _)| i)
        .collect()
}

fn unpack(value: u64) -> Vec<usize> {
    let count = ((value >> 24) & 3) as usize;
    (0..count).map(|k| ((value >> (8 * k)) & 0xff) as usize).collect()
}

pub fn lookup(data: &Data, raw: &str) -> Word {
    let mut letters: Vec<char> = Vec::new();
    let mut marked = None;
    let mut pending = false;
    for c in raw.chars().flat_map(|c| c.to_lowercase()) {
        if c == '+' {
            pending = true;
            continue;
        }
        if pending {
            marked = Some(letters.len());
            pending = false;
        }
        letters.push(c);
    }
    let word: String = letters.iter().collect();
    let vowels = vowel_positions(&letters);

    if let Some(pos) = marked {
        return Word { letters, stress: Some(pos), source: Source::Marked, alternatives: vec![], hyphen: false };
    }
    if let Some(pos) = letters.iter().position(|c| *c == 'ё') {
        return Word { letters, stress: Some(pos), source: Source::Yo, alternatives: vec![], hyphen: false };
    }
    if vowels.is_empty() {
        return Word { letters, stress: None, source: Source::NoVowel, alternatives: vec![], hyphen: false };
    }
    if is_proclitic(&word) || is_enclitic(&word) {
        return Word { letters, stress: None, source: Source::Weak, alternatives: vec![], hyphen: false };
    }
    if vowels.len() == 1 {
        return Word { letters, stress: Some(vowels[0]), source: Source::Single, alternatives: vec![], hyphen: false };
    }
    if let Some(value) = data.stress.get(word.as_bytes()) {
        let all = unpack(value);
        if let Some((first, rest)) = all.split_first() {
            return Word { letters, stress: Some(*first), source: Source::Lexicon, alternatives: rest.to_vec(), hyphen: false };
        }
    }
    if let Some(pos) = data.yo.get(word.as_bytes()) {
        let pos = pos as usize;
        letters[pos] = 'ё';
        return Word { letters, stress: Some(pos), source: Source::Restored, alternatives: vec![], hyphen: false };
    }
    let from_end = predict(data, &word);
    let index = vowels.len().saturating_sub(1 + from_end);
    Word { stress: Some(vowels[index]), letters, source: Source::Guess, alternatives: vec![], hyphen: false }
}

fn predict(data: &Data, word: &str) -> usize {
    let chars: Vec<char> = word.chars().collect();
    for n in (1..=5).rev() {
        if chars.len() > n {
            let suffix: String = chars[chars.len() - n..].iter().collect();
            if let Some(d) = data.suffix.get(suffix.as_bytes()) {
                return d as usize;
            }
        }
    }
    1
}
