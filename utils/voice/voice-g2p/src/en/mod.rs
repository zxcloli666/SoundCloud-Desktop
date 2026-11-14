mod lexicon;
pub(crate) mod normalize;
pub mod numbers;

pub use lexicon::Lexicon;
use normalize::{pieces, Piece};

const EXTRA: &[(&str, &str)] = &[
    ("weeknd", "wˈikɛnd"),
    ("spotify", "spˈɑɾəfI"),
    ("soundcloud", "sˈWndklWd"),
    ("playlist", "plˈAlɪst"),
];

pub struct English {
    lexicon: Lexicon,
}

pub struct Phonemes {
    pub text: String,
    pub unknown: Vec<String>,
}

impl English {
    pub fn new(lexicon: Lexicon) -> Self {
        English { lexicon }
    }

    pub fn phonemize(&self, text: &str) -> Phonemes {
        let mut out = String::new();
        let mut unknown = Vec::new();
        for piece in pieces(text) {
            match piece {
                Piece::Punct(c) => out.push(c),
                Piece::Word(w) => {
                    if !out.is_empty() && !out.ends_with(' ') {
                        out.push(' ');
                    }
                    match self.word(&w) {
                        Some(ph) => out.push_str(&ph),
                        None => {
                            unknown.push(w.clone());
                            out.push_str(&self.spell(&w));
                        }
                    }
                }
            }
        }
        Phonemes { text: out, unknown }
    }

    fn spell(&self, word: &str) -> String {
        word.chars()
            .filter(|c| c.is_ascii_alphabetic())
            .filter_map(|c| self.lexicon.get(&c.to_ascii_uppercase().to_string()))
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn word(&self, w: &str) -> Option<String> {
        if let Some((_, p)) = EXTRA.iter().find(|(k, _)| *k == w.to_lowercase()) {
            return Some(p.to_string());
        }
        if let Some(p) = self.lexicon.get(w) {
            return Some(p.to_string());
        }
        let lower = w.to_lowercase();
        if let Some(p) = self.lexicon.get(&lower) {
            return Some(p.to_string());
        }
        let mut cap = lower.clone();
        if let Some(first) = cap.get_mut(0..1) {
            first.make_ascii_uppercase();
        }
        if let Some(p) = self.lexicon.get(&cap) {
            return Some(p.to_string());
        }
        if let Some((stem, ending)) = lower.rsplit_once('\'') {
            let base = self.word(stem)?;
            let tail = match ending {
                "s" => match base.chars().last() {
                    Some('s' | 'z' | 'ʃ' | 'ʒ' | 'ʧ' | 'ʤ') => "ᵻz",
                    Some('p' | 't' | 'k' | 'f' | 'θ') => "s",
                    _ => "z",
                },
                "d" => "d",
                "ll" => "l",
                "re" => "ɚ",
                "ve" => "v",
                "m" => "m",
                _ => return None,
            };
            return Some(format!("{base}{tail}"));
        }
        if let Some((a, b)) = lower.split_once('-') {
            return Some(format!("{} {}", self.word(a)?, self.word(b)?));
        }
        for (suffix, tail) in [("ies", "z"), ("es", "ᵻz"), ("s", "z"), ("ed", "d"), ("ing", "ɪŋ"), ("ly", "li")] {
            if let Some(stem) = lower.strip_suffix(suffix) {
                if stem.len() < 3 {
                    continue;
                }
                let stem = if suffix == "ies" { format!("{stem}y") } else { stem.to_string() };
                for candidate in [stem.clone(), format!("{stem}e")] {
                    if let Some(p) = self.lexicon.get(&candidate) {
                        let tail = match (suffix, p.chars().last()) {
                            ("s", Some('s' | 'z' | 'ʃ' | 'ʒ' | 'ʧ' | 'ʤ')) => "ᵻz",
                            ("s", Some('p' | 't' | 'k' | 'f' | 'θ')) => "s",
                            ("ed", Some('t' | 'd')) => "ᵻd",
                            ("ed", Some('p' | 'k' | 'f' | 's' | 'ʃ' | 'θ' | 'ʧ')) => "t",
                            _ => tail,
                        };
                        return Some(format!("{p}{tail}"));
                    }
                }
            }
        }
        None
    }
}
