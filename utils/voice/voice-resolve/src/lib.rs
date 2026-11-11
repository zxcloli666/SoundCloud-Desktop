mod alias;
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
use voice_nlu::{Intent, Kind, Parsed, parse, parse_name, parse_one};

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

pub fn resolve(parsed: &Parsed, catalog: &dyn Catalog, boosts: &Boosts, bare: bool) -> Decision {
    let mut expanded = parsed.clone();
    expanded.queries = alias::expand(&parsed.queries);
    let cands = catalog.candidates(&expanded.queries, &Kind::ALL);
    let ranked = rank(&expanded, cands, boosts);
    score::decide(&ranked, bare)
}

pub fn named(name: &str) -> Vec<Parsed> {
    let mut main = parse_name(name);
    let other = main.kind_alt.take().map(|alt| Parsed {
        queries: alt.queries,
        kind_hint: alt.kind_hint,
        ..main.clone()
    });
    let mut readings: Vec<Parsed> = std::iter::once(main).chain(other).collect();
    for reading in &mut readings {
        reading.queries = alias::expand(&reading.queries);
    }
    readings
}

pub fn matches(
    readings: &[Parsed],
    found: &[Entity],
    kinds: &[Kind],
    boosts: &Boosts,
) -> Vec<Scored> {
    let wanted = || found.iter().filter(|e| kinds.contains(&e.kind)).cloned();
    readings
        .iter()
        .map(|reading| score::fitting(rank(reading, wanted().collect(), boosts)))
        .find(|fit| !fit.is_empty())
        .unwrap_or_default()
}

pub fn interpret(text: &str, catalog: &dyn Catalog, boosts: &Boosts) -> Vec<Outcome> {
    parse(text)
        .into_iter()
        .flat_map(|parsed| interpret_split(parsed, catalog, boosts))
        .collect()
}

const BARE_POP_MIN: u64 = 20_000;
const WHOLE_NAME_MIN: f32 = 0.97;
const SPLIT_PART_MIN: f32 = 0.95;

fn sure(o: &Outcome, min: f32) -> bool {
    if !o.parsed.intent.needs_entity() && o.parsed.intent != Intent::None {
        return true;
    }
    match &o.decision {
        Some(Decision::Act { pick }) => pick.sim >= min,
        Some(Decision::Ask { first, .. }) => first.sim >= min,
        _ => false,
    }
}

fn interpret_split(mut parsed: Parsed, catalog: &dyn Catalog, boosts: &Boosts) -> Vec<Outcome> {
    let splits = std::mem::take(&mut parsed.split);
    let joined = interpret_parsed(parsed, catalog, boosts);
    if splits.is_empty() || sure(&joined, WHOLE_NAME_MIN) {
        return vec![joined];
    }
    for parts in splits {
        let outs: Vec<Outcome> = parts
            .into_iter()
            .map(|p| interpret_parsed(p, catalog, boosts))
            .collect();
        if outs.iter().all(|o| sure(o, SPLIT_PART_MIN)) {
            return outs;
        }
    }
    vec![joined]
}

fn whole_name(parsed: &Parsed, catalog: &dyn Catalog, boosts: &Boosts) -> Option<Outcome> {
    if parsed.alt.is_empty() {
        return None;
    }
    let mut whole = parsed.clone();
    whole.queries = parsed.alt.clone();
    let d = resolve(&whole, catalog, boosts, true);
    let sim = match &d {
        Decision::Act { pick } => pick.sim,
        Decision::Ask { first, .. } => first.sim,
        Decision::NotFound => return None,
    };
    if sim < WHOLE_NAME_MIN {
        return None;
    }
    Some(Outcome {
        intent: Intent::Play,
        parsed: whole,
        decision: Some(d),
    })
}

pub fn interpret_one(text: &str, catalog: &dyn Catalog, boosts: &Boosts) -> Outcome {
    interpret_parsed(parse_one(text), catalog, boosts)
}

fn interpret_parsed(parsed: Parsed, catalog: &dyn Catalog, boosts: &Boosts) -> Outcome {
    if let Some(whole) = whole_name(&parsed, catalog, boosts) {
        return whole;
    }
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
            let popular = match &d {
                Decision::Act { pick } => pick.entity.popularity >= BARE_POP_MIN,
                Decision::Ask { first, .. } => first.entity.popularity >= BARE_POP_MIN,
                Decision::NotFound => false,
            };
            if popular {
                intent = Intent::Play;
                decision = Some(d);
            }
        }
    } else if matches!(
        intent,
        Intent::Play | Intent::QueueAdd | Intent::PlaySimilar
    ) {
        let d = resolve(&parsed, catalog, boosts, false);
        let d = match (&d, &parsed.kind_alt) {
            (Decision::NotFound, Some(alt)) => {
                let mut again = parsed.clone();
                again.queries = alt.queries.clone();
                again.kind_hint = alt.kind_hint;
                resolve(&again, catalog, boosts, false)
            }
            _ => d,
        };
        let sure = match &d {
            Decision::Act { pick } => pick.sim >= score::WEAK_VERB_MIN,
            Decision::Ask { first, .. } => first.sim >= score::WEAK_VERB_MIN,
            Decision::NotFound => false,
        };
        if matches!(intent, Intent::Play | Intent::QueueAdd)
            && (matches!(d, Decision::NotFound) || (parsed.weak_verb && !sure))
        {
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

#[cfg(test)]
mod tests {
    use super::*;

    const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tКино\t\t9000000\t
track\tЦепи\tСкриптонит\t3000000\t
track\tПауза\tСкриптонит\t400000\t
album\tГруппа крови\tКино\t2000000\t
";

    fn search(name: &str, kinds: &[Kind]) -> Vec<String> {
        let catalog = FixtureCatalog::from_tsv(ROWS, true);
        let readings = named(name);
        let variants: Vec<_> = readings.iter().flat_map(|r| r.queries.clone()).collect();
        let found = catalog.candidates(&variants, &Kind::ALL);
        matches(&readings, &found, kinds, &Boosts::none())
            .iter()
            .map(|scored| scored.entity.label())
            .collect()
    }

    #[test]
    fn a_name_finds_its_entities_best_first() {
        assert_eq!(
            search("Скриптонит Цепи", &Kind::ALL)[0],
            "Скриптонит - Цепи"
        );
        assert_eq!(search("scriptonite", &Kind::ALL)[0], "Скриптонит");
        assert_eq!(
            search("альбом группа крови", &Kind::ALL)[0],
            "Кино - Группа крови"
        );
    }

    #[test]
    fn a_name_that_sounds_like_a_command_is_still_a_name() {
        assert_eq!(search("Пауза", &Kind::ALL), ["Скриптонит - Пауза"]);
        assert_eq!(
            interpret_one(
                "пауза",
                &FixtureCatalog::from_tsv(ROWS, true),
                &Boosts::none()
            )
            .intent,
            Intent::Pause
        );
    }

    #[test]
    fn only_the_asked_kinds_come_back() {
        assert_eq!(search("скриптонит", &[Kind::Artist]), ["Скриптонит"]);
        assert!(search("скриптонит", &[Kind::Album]).is_empty());
    }

    #[test]
    fn a_name_nobody_has_finds_nothing() {
        assert!(search("абырвалгович", &Kind::ALL).is_empty());
        assert!(search("", &Kind::ALL).is_empty());
    }
}
