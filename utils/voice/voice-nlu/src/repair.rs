use crate::lexicon::{self, PRE};

const GLUE_VERBS: &[&str] = &["включи", "вруби", "поставь", "запусти", "сыграй"];
const GLUED_FROM: usize = 4;

fn known(w: &str) -> bool {
    lexicon::is_known(w) || lexicon::slang(w).is_some()
}

pub fn context(words: Vec<String>) -> Vec<String> {
    let mut out = words.clone();
    for i in 0..words.len() {
        let next = words.get(i + 1).map(String::as_str).unwrap_or("");
        let loud = next.starts_with("громк") || next.starts_with("звук");
        let after_wish = i > 0 && (words[i - 1] == "чтобы" || words[i - 1] == "шоб")
            || i > 1 && (words[i - 2] == "чтобы" || words[i - 2] == "шоб");
        let to = match words[i].as_str() {
            "накинь" | "подкинь" | "подкрути" | "добавь" if loud => {
                "прибавь"
            }
            "скинь" | "сбрось" | "скрути" | "прикрути" if loud => "убавь",
            "включила" | "включил" if after_wish => "включи",
            "поставила" | "поставил" if after_wish => "поставь",
            "ван" if i > 0 && words[i - 1] == "репит" => "one",
            _ => continue,
        };
        out[i] = to.to_string();
    }
    out
}

pub fn glue(words: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let w = &words[i];
        if let Some(next) = words.get(i + 1) {
            let joined = format!("{w}{next}");
            if known(&joined) && (!known(w) || !known(next) || w == "по") {
                out.push(joined);
                i += 2;
                continue;
            }
        }
        if !known(w) && w.chars().count() >= 9 {
            if let Some(v) = GLUE_VERBS.iter().find(|v| w.starts_with(**v)) {
                out.push(v.to_string());
                out.push(w[v.len()..].to_string());
                i += 1;
                continue;
            }
        }
        if let Some((first, second)) = run_together(w) {
            out.push(first.to_string());
            out.push(second.to_string());
            i += 1;
            continue;
        }
        out.push(w.clone());
        i += 1;
    }
    out
}

fn run_together(w: &str) -> Option<(&str, &str)> {
    if known(w) || lexicon::canon(w).is_some() {
        return None;
    }
    let cuts: Vec<usize> = w.char_indices().map(|(at, _)| at).collect();
    let last = cuts.len().checked_sub(GLUED_FROM)?;
    (GLUED_FROM..=last)
        .map(|n| w.split_at(cuts[n]))
        .find(|(first, second)| known(first) && known(second))
}

pub fn stutter(words: Vec<String>) -> Vec<String> {
    let mut out = Vec::new();
    for i in 0..words.len() {
        let w = &words[i];
        let cut = w.chars().count() >= 3
            && !known(w)
            && [1, 2].iter().any(|&gap| {
                words
                    .get(i + gap)
                    .is_some_and(|n| n.len() > w.len() && n.starts_with(w.as_str()))
                    && words[i + 1..i + gap]
                        .iter()
                        .all(|m| PRE.contains(&m.as_str()))
            });
        if !cut {
            out.push(w.clone());
        }
    }
    out
}
