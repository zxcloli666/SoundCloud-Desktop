mod anchor;
mod correct;
mod fold;
mod intent;
mod lexicon;
mod names;
mod normalize;
mod numbers;
mod objection;
mod repair;
mod reworded;
mod slots;
mod steps;
mod types;
mod variants;

pub use fold::{distance, fold, fold_words, similarity, skeleton, strict_similarity, word_ends};
pub use names::Names;
pub use normalize::{Normalized, Tok, normalize};
pub use types::{Intent, Kind, Parsed, Reading, Variant};
pub use variants::lemma;

pub use steps::parse;

pub fn parse_one(text: &str) -> Parsed {
    parse_toks(text, normalize(text).toks).0
}

pub fn parse_name(text: &str) -> Parsed {
    let toks = normalize(text).toks;
    let s = slots::extract(&toks, &intent::Detected::none());
    let normalized = toks
        .iter()
        .map(|t| t.w.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let kind_alt = s.alt.map(|(kind_hint, raw)| Reading {
        queries: variants::expand(&raw, false),
        kind_hint,
    });
    Parsed {
        intent: Intent::Play,
        kind_hint: s.kind_hint,
        queries: variants::expand(&s.raw, true),
        number: None,
        heard: text.to_string(),
        normalized,
        bare: false,
        weak_verb: false,
        fraction: None,
        alt: Vec::new(),
        kind_alt,
        split: Vec::new(),
    }
}

pub(crate) fn parse_toks(text: &str, mut toks: Vec<Tok>) -> (Parsed, bool) {
    let original = toks.clone();
    let mut cut = false;
    if !intent::indirect_hit(&toks) {
        match intent::negation(&toks) {
            intent::Negation::Cancel => return (cancelled(text, &toks), true),
            intent::Negation::Tail(j) => toks.drain(..j).for_each(drop),
            intent::Negation::Clear => {}
        }
        if let Some(k) = intent::remark(&toks) {
            toks.truncate(k);
            cut = true;
        }
    }
    let mut det = intent::detect(&toks);
    if det.intent == Intent::None && !det.blocked {
        if let Some(found) = anchor::find(&toks) {
            toks = found.window;
            det = found.det;
            cut = true;
        } else if let Some(fixed) = intent::fuzzy_fix(&toks) {
            let again = intent::detect(&fixed);
            if again.intent != Intent::None {
                toks = fixed;
                det = again;
            }
        }
    }
    let s = slots::extract(&toks, &det);
    let entity_intent = matches!(det.intent, Intent::Play | Intent::QueueAdd);
    let queries = variants::expand(&s.raw, entity_intent);
    let edge = |t: Option<&Tok>| {
        t.is_some_and(|t| {
            let w = t.w.as_str();
            toks.len() > 1
                && (lexicon::SUBJECTS.contains(&w)
                    || lexicon::TRANSPORT_VERBS.contains(&w)
                    || lexicon::PLAY_WEAK.contains(&w))
        })
    };
    let greets = |t: &Tok| lexicon::GREETINGS.contains(&t.w.as_str());
    let bare = det.intent == Intent::None
        && queries.iter().any(|q| !q.kept_fillers)
        && toks.len() <= 8
        && !toks.iter().all(greets)
        && !edge(toks.first())
        && !edge(toks.last());
    let queries = if det.intent == Intent::None && !bare {
        Vec::new()
    } else {
        queries
    };
    let alt = if cut {
        whole_name(&original)
    } else if det.intent == Intent::Resume {
        greeting(&toks)
    } else {
        Vec::new()
    };
    let kind_alt = s.alt.map(|(kind_hint, raw)| Reading {
        queries: variants::expand(&raw, false),
        kind_hint,
    });
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
        fraction: det.fraction,
        alt,
        kind_alt,
        split: Vec::new(),
    };
    (parsed, blocked)
}

pub(crate) fn whole_name(toks: &[Tok]) -> Vec<Variant> {
    let rest: Vec<Tok> = toks
        .iter()
        .filter(|t| !lexicon::PLAY_STRONG.contains(&t.w.as_str()))
        .cloned()
        .collect();
    let loose = |t: Option<&Tok>| t.is_some_and(|t| lexicon::PRE.contains(&t.w.as_str()));
    if loose(rest.first()) || loose(rest.last()) {
        return Vec::new();
    }
    let s = slots::extract(&rest, &intent::Detected::none());
    variants::expand(&s.raw, false)
}

fn greeting(toks: &[Tok]) -> Vec<Variant> {
    let verb = toks
        .iter()
        .position(|t| lexicon::PLAY_STRONG.contains(&t.w.as_str()));
    let after = verb.map_or(&[][..], |at| &toks[at + 1..]);
    let said = after
        .iter()
        .filter(|t| lexicon::GREETINGS.contains(&t.w.as_str()));
    let name: Vec<Tok> = said.cloned().collect();
    let raw = slots::Raw {
        full: name.clone(),
        plain: name,
        ..slots::Raw::default()
    };
    variants::expand(&raw, false)
}

fn cancelled(text: &str, toks: &[Tok]) -> Parsed {
    Parsed {
        intent: Intent::None,
        kind_hint: None,
        queries: Vec::new(),
        number: None,
        heard: text.to_string(),
        normalized: toks
            .iter()
            .map(|t| t.w.as_str())
            .collect::<Vec<_>>()
            .join(" "),
        bare: false,
        weak_verb: false,
        fraction: None,
        alt: Vec::new(),
        kind_alt: None,
        split: Vec::new(),
    }
}
