mod fold;
mod intent;
mod lexicon;
mod normalize;
mod numbers;
mod slots;
mod types;
mod variants;

pub use fold::{distance, fold, fold_words, similarity, skeleton};
pub use normalize::{Normalized, Tok, normalize};
pub use types::{Intent, Kind, Parsed, Variant};
pub use variants::lemma;

pub fn parse(text: &str) -> Parsed {
    let n = normalize(text);
    let mut toks = n.toks;
    let mut det = intent::detect(&toks);
    if det.intent == Intent::None && !det.blocked {
        if let Some(fixed) = intent::fuzzy_fix(&toks) {
            let again = intent::detect(&fixed);
            if again.intent != Intent::None {
                toks = fixed;
                det = again;
            }
        }
    }
    let s = slots::extract(&toks, &det);
    let queries = variants::expand(&s.raw);
    let bare = det.intent == Intent::None && !queries.is_empty() && toks.len() <= 8;
    let queries = if det.intent == Intent::None && !bare {
        Vec::new()
    } else {
        queries
    };
    let normalized = toks
        .iter()
        .map(|t| t.w.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    Parsed {
        intent: det.intent,
        kind_hint: s.kind_hint,
        queries,
        number: det.number,
        heard: text.to_string(),
        normalized,
        bare,
        weak_verb: det.weak,
    }
}
