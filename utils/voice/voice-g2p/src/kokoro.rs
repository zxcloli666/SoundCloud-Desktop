use std::collections::HashSet;

const MAX_TOKENS: usize = 400;

pub struct Vocab {
    chars: HashSet<char>,
}

impl Vocab {
    pub fn from_tokens_txt(text: &str) -> Self {
        let mut chars = HashSet::new();
        for line in text.lines() {
            let mut it = line.chars();
            if let Some(c) = it.next() {
                if it.next() == Some(' ') {
                    chars.insert(c);
                }
            }
        }
        Vocab { chars }
    }

    pub fn contains(&self, c: char) -> bool {
        self.chars.contains(&c)
    }

    pub fn missing(&self, ipa: &str) -> Vec<char> {
        let mut out: Vec<char> = ipa.chars().filter(|c| !self.chars.contains(c)).collect();
        out.sort();
        out.dedup();
        out
    }
}

pub const RU_TO_KOKORO: &[(char, char)] = &[('ʐ', 'ʒ')];

pub fn map_russian(ipa: &str) -> String {
    ipa.chars()
        .map(|c| RU_TO_KOKORO.iter().find(|(from, _)| *from == c).map_or(c, |(_, to)| *to))
        .collect()
}

pub fn split_sentences(ipa: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for c in ipa.chars() {
        current.push(c);
        let end = matches!(c, '.' | '!' | '?' | '…');
        let long = current.chars().count() >= MAX_TOKENS && matches!(c, ',' | ';' | ':' | ' ');
        if end || long {
            let trimmed = current.trim();
            if !trimmed.is_empty() {
                out.push(trimmed.to_string());
            }
            current.clear();
        }
    }
    let trimmed = current.trim();
    if !trimmed.is_empty() {
        out.push(trimmed.to_string());
    }
    out
}
