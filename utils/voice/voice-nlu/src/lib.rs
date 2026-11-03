mod fold;
mod intent;
mod lexicon;
mod normalize;
mod numbers;
mod slots;
mod steps;
mod types;
mod variants;

pub use fold::{distance, fold, fold_words, similarity, skeleton};
pub use normalize::{Normalized, Tok, normalize};
pub use types::{Intent, Kind, Parsed, Variant};
pub use variants::lemma;

pub use steps::parse;

pub fn parse_one(text: &str) -> Parsed {
    parse_toks(text, normalize(text).toks).0
}

pub(crate) fn parse_toks(text: &str, mut toks: Vec<Tok>) -> (Parsed, bool) {
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
    let blocked = det.blocked;
    let parsed = Parsed {
        intent: det.intent,
        kind_hint: s.kind_hint,
        queries,
        number: det.number,
        heard: text.to_string(),
        normalized,
        bare,
        weak_verb: det.weak,
    };
    (parsed, blocked)
}
