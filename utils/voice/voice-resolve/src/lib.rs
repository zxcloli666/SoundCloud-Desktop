mod answer;
mod catalog;
mod entity;
mod keys;
mod score;

pub use answer::answer_ask;
pub use catalog::{Catalog, FixtureCatalog};
pub use entity::{Decision, Entity, Scored};
pub use score::{Boosts, rank};

use serde::Serialize;
use voice_nlu::{Intent, Kind, Parsed, parse, parse_one};

#[derive(Debug, Clone, Serialize)]
pub struct Outcome {
    pub intent: Intent,
    pub parsed: Parsed,
    pub decision: Option<Decision>,
}

impl Outcome {
    pub fn acts(&self) -> bool {
        if self.intent == Intent::None {
            return false;
        }
        if self.intent.needs_entity() {
            return matches!(self.decision, Some(Decision::Act { .. }));
        }
        true
    }
}

pub fn resolve(
    parsed: &Parsed,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: bool,
) -> Decision {
    let cands = catalog.candidates(&parsed.queries, &Kind::ALL);
    let ranked = rank(parsed, cands, boosts);
    score::decide(&ranked, bare)
}

pub fn interpret(text: &str, catalog: &dyn Catalog, boosts: &Boosts) -> Vec<Outcome> {
    parse(text)
        .into_iter()
        .map(|parsed| interpret_parsed(parsed, catalog, boosts))
        .collect()
}

pub fn interpret_one(text: &str, catalog: &dyn Catalog, boosts: &Boosts) -> Outcome {
    interpret_parsed(parse_one(text), catalog, boosts)
}

fn interpret_parsed(parsed: Parsed, catalog: &dyn Catalog, boosts: &Boosts) -> Outcome {
    let mut intent = parsed.intent;
    let mut decision = None;
    if parsed.queries.is_empty() {
        return Outcome {
            intent,
            parsed,
            decision,
        };
    }
    if intent == Intent::None {
        if parsed.bare {
            let d = resolve(&parsed, catalog, boosts, true);
            if matches!(d, Decision::Act { .. } | Decision::Ask { .. }) {
                intent = Intent::Play;
                decision = Some(d);
            }
        }
    } else if matches!(
        intent,
        Intent::Play | Intent::QueueAdd | Intent::PlaySimilar
    ) {
        let d = resolve(&parsed, catalog, boosts, false);
        if intent == Intent::Play && matches!(d, Decision::NotFound) {
            intent = Intent::None;
        }
        decision = Some(d);
    }
    Outcome {
        intent,
        parsed,
        decision,
    }
}
