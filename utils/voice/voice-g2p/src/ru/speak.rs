use super::data::Data;
use super::g2p::unit_ipa;
use super::normalize::Normalizer;
use super::respell::{respell, Letter};
use super::stress::{self, is_enclitic, is_hyphen_suffix, is_proclitic, Source, Word};

const PUNCT: &str = ",.!?;:…—";

pub struct Russian {
    normalizer: Normalizer,
    data: Data,
}

pub struct Spoken {
    pub text: String,
    pub ipa: String,
    pub chars: String,
    pub words: Vec<(String, Source)>,
}

enum Item {
    Word(String),
    Punct(char),
}

fn items(text: &str) -> Vec<Item> {
    let chars: Vec<char> = text.chars().collect();
    let letter = |c: char| c.is_alphabetic() || c == '+';
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if letter(chars[i]) {
            let mut j = i;
            while j < chars.len() && (letter(chars[j]) || (chars[j] == '-' && j + 1 < chars.len() && letter(chars[j + 1]))) {
                j += 1;
            }
            out.push(Item::Word(chars[i..j].iter().collect()));
            i = j;
        } else {
            if PUNCT.contains(chars[i]) {
                out.push(Item::Punct(chars[i]));
            }
            i += 1;
        }
    }
    out
}

struct Output {
    ipa: String,
    chars: String,
}

impl Output {
    fn space(&mut self) {
        if !self.ipa.is_empty() && !self.ipa.ends_with(' ') {
            self.ipa.push(' ');
        }
        if !self.chars.is_empty() && !self.chars.ends_with(' ') {
            self.chars.push(' ');
        }
    }

    fn unit(&mut self, words: &[Word]) {
        let letters: Vec<Letter> = words.iter().flat_map(respell).collect();
        self.space();
        self.ipa.push_str(&unit_ipa(&letters));
        for (k, word) in words.iter().enumerate() {
            if k > 0 {
                self.chars.push(if word.hyphen { '-' } else { ' ' });
            }
            for (i, c) in word.letters.iter().enumerate() {
                if word.stress == Some(i) && !matches!(word.source, Source::Weak | Source::NoVowel) {
                    self.chars.push('+');
                }
                self.chars.push(*c);
            }
        }
    }

    fn punct(&mut self, p: char) {
        self.ipa.push(p);
        self.chars.push(p);
    }
}

fn take_unit(pending: &mut Vec<Word>, host: Word) -> Vec<Word> {
    let mut words = std::mem::take(pending);
    words.push(host);
    words
}

impl Russian {
    pub fn new(data: Data) -> Self {
        Russian {
            normalizer: Normalizer::new(),
            data,
        }
    }

    #[cfg(feature = "bundled")]
    pub fn bundled() -> Self {
        Russian::new(Data::bundled())
    }

    pub fn normalize(&self, text: &str) -> String {
        self.normalizer.run(text)
    }

    pub fn stress(&self, word: &str) -> Word {
        stress::lookup(&self.data, word)
    }

    fn parts(&self, raw: &str) -> Vec<Word> {
        let whole = self.stress(raw);
        if !raw.contains('-') || matches!(whole.source, Source::Lexicon | Source::Marked) {
            return vec![whole];
        }
        let mut words: Vec<Word> = Vec::new();
        for part in raw.split('-').filter(|p| !p.is_empty()) {
            let mut word = self.stress(part);
            word.hyphen = !words.is_empty();
            if word.hyphen && is_hyphen_suffix(&part.to_lowercase()) {
                word.stress = None;
                word.source = Source::Weak;
            }
            words.push(word);
        }
        words
    }

    pub fn speak(&self, text: &str) -> Spoken {
        let normalized = self.normalizer.run(text);
        let mut out = Output { ipa: String::new(), chars: String::new() };
        let mut report = Vec::new();
        let mut units: Vec<Vec<Word>> = Vec::new();
        let mut pending: Vec<Word> = Vec::new();

        for item in items(&normalized) {
            match item {
                Item::Punct(p) => {
                    if let Some(mut last) = pending.pop() {
                        if last.stress.is_none() {
                            last.stress = last.letters.iter().position(|c| stress::VOWELS.contains(*c));
                        }
                        units.push(take_unit(&mut pending, last));
                    }
                    for unit in units.drain(..) {
                        out.unit(&unit);
                    }
                    out.punct(p);
                }
                Item::Word(raw) => {
                    for word in self.parts(&raw) {
                        let spelled: String = word.letters.iter().collect();
                        report.push((spelled.clone(), word.source));
                        let attaches = (is_enclitic(&spelled) || (word.source == Source::Weak && !is_proclitic(&spelled)))
                            && pending.is_empty();
                        if attaches && !units.is_empty() {
                            units.last_mut().unwrap().push(word);
                        } else if is_proclitic(&spelled) {
                            pending.push(word);
                        } else {
                            units.push(take_unit(&mut pending, word));
                        }
                    }
                }
            }
        }
        if let Some(mut last) = pending.pop() {
            if last.stress.is_none() {
                last.stress = last.letters.iter().position(|c| stress::VOWELS.contains(*c));
            }
            units.push(take_unit(&mut pending, last));
        }
        for unit in units.drain(..) {
            out.unit(&unit);
        }
        Spoken { text: normalized, ipa: out.ipa, chars: out.chars, words: report }
    }
}
