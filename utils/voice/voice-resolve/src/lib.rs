mod alias;
mod answer;
mod bare;
mod catalog;
mod entity;
mod keys;
mod phrase;
mod score;

pub use answer::answer_ask;
pub use bare::Bare;
pub use catalog::{Catalog, FixtureCatalog};
pub use entity::{Decision, Entity, Scored};
pub use phrase::{Lookup, Phrase};
pub use score::{Boosts, rank};

use serde::Serialize;
use voice_nlu::{Intent, Kind, Names, Parsed, parse_name, parse_one};

#[derive(Debug, Clone, Serialize)]
pub struct Outcome {
    pub intent: Intent,
    pub parsed: Parsed,
    pub decision: Option<Decision>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub candidates: Vec<Entity>,
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
    score::decide(&ranked(parsed, catalog, boosts), bare)
}

fn ranked(parsed: &Parsed, catalog: &dyn Catalog, boosts: &Boosts) -> Vec<Scored> {
    let mut expanded = parsed.clone();
    expanded.queries = alias::expand(&parsed.queries);
    let cands = catalog.candidates(&expanded.queries, &Kind::ALL);
    rank(&expanded, cands, boosts)
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

pub fn interpret(
    text: &str,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: Bare,
    names: &Names,
) -> Vec<Outcome> {
    understand(&Phrase::read(text, names), catalog, boosts, bare)
}

pub fn understand(
    phrase: &Phrase,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: Bare,
) -> Vec<Outcome> {
    let reading = phrase.reading(catalog, boosts);
    let split = |parsed: &Parsed| interpret_split(parsed.clone(), catalog, boosts, bare);
    runnable(reading.iter().flat_map(split).collect())
}

fn runnable(mut steps: Vec<Outcome>) -> Vec<Outcome> {
    let nothing = |step: &Outcome| step.intent == Intent::None;
    if steps.len() > 1 && nothing(&steps[0]) {
        steps.truncate(1);
    } else if steps.len() > 1 {
        steps.retain(|step| !nothing(step));
    }
    steps
}

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

fn interpret_split(
    mut parsed: Parsed,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: Bare,
) -> Vec<Outcome> {
    let splits = std::mem::take(&mut parsed.split);
    let joined = interpret_parsed(parsed, catalog, boosts, bare);
    if splits.is_empty() || sure(&joined, WHOLE_NAME_MIN) {
        return vec![joined];
    }
    for parts in splits {
        let outs: Vec<Outcome> = parts
            .into_iter()
            .map(|p| interpret_parsed(p, catalog, boosts, bare))
            .collect();
        if outs.iter().all(|o| sure(o, SPLIT_PART_MIN)) {
            return outs;
        }
    }
    vec![joined]
}

fn whole_name(
    parsed: &Parsed,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: Bare,
) -> Option<Outcome> {
    if parsed.alt.is_empty() {
        return None;
    }
    let mut whole = parsed.clone();
    whole.queries = parsed.alt.clone();
    let d = resolve(&whole, catalog, boosts, true);
    let top = match &d {
        Decision::Act { pick } => pick,
        Decision::Ask { first, .. } => first,
        Decision::NotFound => return None,
    };
    let of_another_kind = whole.kind_hint.is_some_and(|kind| kind != top.entity.kind);
    if top.sim < WHOLE_NAME_MIN || parsed.intent.is_control() && of_another_kind {
        return None;
    }
    if parsed.intent == Intent::None && !bare.trusts(&whole, &d) {
        return None;
    }
    Some(Outcome {
        intent: Intent::Play,
        parsed: whole,
        decision: Some(d),
        candidates: Vec::new(),
    })
}

pub fn interpret_one(text: &str, catalog: &dyn Catalog, boosts: &Boosts, bare: Bare) -> Outcome {
    interpret_parsed(parse_one(text), catalog, boosts, bare)
}

fn interpret_parsed(parsed: Parsed, catalog: &dyn Catalog, boosts: &Boosts, bare: Bare) -> Outcome {
    if let Some(whole) = whole_name(&parsed, catalog, boosts, bare) {
        return whole;
    }
    let mut intent = parsed.intent;
    let mut decision = None;
    let mut candidates = Vec::new();
    if parsed.queries.is_empty() {
        return Outcome {
            intent,
            parsed,
            decision,
            candidates,
        };
    }
    if intent == Intent::None {
        if parsed.bare {
            match said_alone(&parsed, catalog, boosts, bare) {
                Ok(d) => {
                    intent = Intent::Play;
                    decision = Some(d);
                }
                Err(hits) => candidates = hits,
            }
        }
    } else if matches!(
        intent,
        Intent::Play | Intent::QueueAdd | Intent::PlaySimilar
    ) {
        let d = resolve(&parsed, catalog, boosts, false);
        let d = match (&d, with_kind_in_name(&parsed)) {
            (Decision::NotFound, Some(again)) => resolve(&again, catalog, boosts, true),
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
        candidates,
    }
}

fn said_alone(
    parsed: &Parsed,
    catalog: &dyn Catalog,
    boosts: &Boosts,
    bare: Bare,
) -> Result<Decision, Vec<Entity>> {
    let mut handed = Vec::new();
    for reading in std::iter::once(parsed.clone()).chain(with_kind_in_name(parsed)) {
        let ranked = ranked(&reading, catalog, boosts);
        let d = score::decide(&ranked, true);
        if bare.plays(&reading, &d) {
            return Ok(d);
        }
        if handed.is_empty() {
            handed = bare.hands(ranked);
        }
    }
    Err(handed)
}

fn with_kind_in_name(parsed: &Parsed) -> Option<Parsed> {
    let alt = parsed.kind_alt.as_ref()?;
    Some(Parsed {
        queries: alt.queries.clone(),
        kind_hint: alt.kind_hint,
        ..parsed.clone()
    })
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
                &Boosts::none(),
                Bare::Popular
            )
            .intent,
            Intent::Pause
        );
    }

    #[test]
    fn a_known_artist_missing_from_the_catalog_is_not_swapped_for_a_lookalike() {
        let lookalike = format!("{ROWS}track\tРоманс\tСплин\t2000000\t\n");
        let heard = |rows: &str| {
            interpret_one(
                "поставь рамонс",
                &FixtureCatalog::from_tsv(rows, true),
                &Boosts::none(),
                Bare::Popular,
            )
        };
        assert!(!heard(&lookalike).acts());
        let with_the_artist = format!("{lookalike}artist\tRamones\t\t5000000\t\n");
        match heard(&with_the_artist).decision {
            Some(Decision::Act { pick }) => assert_eq!(pick.entity.label(), "Ramones"),
            other => panic!("the artist is not played: {other:?}"),
        }
        let exact = format!("{ROWS}track\tРамонс\tСплин\t2000000\t\n");
        assert!(heard(&exact).acts());
    }

    const LOOKALIKES: &str = "kind\tname\tartist\tpopularity\taliases
artist\tЛенинград\t\t2600000\t
artist\tЛенинградка\t\t5000\t
artist\tЛенинград Cover\t\t3000\t
track\tWWW\tЛенинград\t2500000\t
playlist\tЛенинград Mix\t\t40000\t
artist\tDrake\t\t78000000\t
artist\tDrake Bell\t\t300000\t
";

    fn played(text: &str) -> String {
        let catalog = FixtureCatalog::from_tsv(LOOKALIKES, true);
        match interpret_one(text, &catalog, &Boosts::none(), Bare::Popular).decision {
            Some(Decision::Act { pick }) => pick.entity.label(),
            other => format!("{other:?}"),
        }
    }

    #[test]
    fn words_after_an_artist_do_not_turn_into_a_title_of_one_sound() {
        for text in [
            "включи ленинград вася",
            "включи ленинград вова",
            "включи ленинград новая",
            "включи вову ленинград",
        ] {
            assert_eq!(played(text), "Ленинград", "{text}");
        }
        assert_eq!(played("включи ленинград www"), "Ленинград - WWW");
        assert_eq!(played("включи www ленинграда"), "Ленинград - WWW");
    }

    #[test]
    fn a_longer_name_wins_over_the_artist_only_when_the_rest_is_said() {
        assert_eq!(played("включи ленинград кавер"), "Ленинград Cover");
        assert_eq!(played("включи ленинград микс"), "Ленинград Mix");
        assert_eq!(played("включи дрейка белла"), "Drake Bell");
        assert_eq!(played("включи дрейк белл"), "Drake Bell");
        assert_eq!(played("включи ленинград каждый"), "Ленинград");
        assert_eq!(played("включи дрейка блин"), "Drake");
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
