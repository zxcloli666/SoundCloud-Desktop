use std::collections::BTreeMap;
use voice_nlu::{Intent, Names};
use voice_resolve::{Bare, Boosts, Decision, FixtureCatalog, Outcome, interpret};

struct Row {
    phrase: String,
    intent: String,
    kind: String,
    entity: String,
    number: String,
    category: String,
    alt: String,
}

fn rows(text: &str) -> Vec<Row> {
    text.lines()
        .skip(1)
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let c: Vec<&str> = l.split('\t').collect();
            let col = |i: usize| c.get(i).copied().unwrap_or("").trim().to_string();
            Row {
                phrase: col(0),
                intent: col(1),
                kind: col(2),
                entity: col(3),
                number: col(4),
                category: col(5),
                alt: col(6),
            }
        })
        .collect()
}

struct Set {
    name: &'static str,
    rows: Vec<Row>,
}

fn sets() -> Vec<Set> {
    vec![
        Set {
            name: "blind",
            rows: rows(include_str!("data/phrases.tsv")),
        },
        Set {
            name: "dev",
            rows: [
                include_str!("data/phrases_dev.tsv"),
                include_str!("data/phrases_dev2.tsv"),
                include_str!("data/phrases_dev3.tsv"),
            ]
            .iter()
            .flat_map(|t| rows(t))
            .collect(),
        },
        Set {
            name: "fresh_r1",
            rows: rows(include_str!("data/phrases_fresh_r1.tsv")),
        },
        Set {
            name: "fresh_r1b",
            rows: rows(include_str!("data/phrases_fresh_r1b.tsv")),
        },
        Set {
            name: "skeptic_r1",
            rows: rows(include_str!("data/phrases_skeptic_r1.tsv")),
        },
        Set {
            name: "skeptic_r1_pass",
            rows: rows(include_str!("data/phrases_skeptic_r1_pass.tsv")),
        },
        Set {
            name: "fresh_r2",
            rows: rows(include_str!("data/phrases_fresh_r2.tsv")),
        },
        Set {
            name: "skeptic_r2",
            rows: rows(include_str!("data/phrases_skeptic_r2.tsv")),
        },
        Set {
            name: "skeptic_r2_pass",
            rows: rows(include_str!("data/phrases_skeptic_r2_pass.tsv")),
        },
    ]
}

const VOICE: [&str; 3] = ["Loli", "Лоля", "롤리"];

#[derive(Default, Clone)]
struct Stat {
    rows: usize,
    intent_ok: usize,
    entity_rows: usize,
    entity_ok: usize,
    asks: usize,
    false_acts: usize,
}

impl Stat {
    fn add(&mut self, o: &Stat) {
        self.rows += o.rows;
        self.intent_ok += o.intent_ok;
        self.entity_rows += o.entity_rows;
        self.entity_ok += o.entity_ok;
        self.asks += o.asks;
        self.false_acts += o.false_acts;
    }
}

fn top_entity(o: &Outcome) -> Option<&voice_resolve::Entity> {
    match o.decision.as_ref()? {
        Decision::Act { pick } => Some(&pick.entity),
        Decision::Ask { first, .. } => Some(&first.entity),
        Decision::NotFound => None,
    }
}

fn joined(os: &[Outcome]) -> String {
    os.iter()
        .map(|o| o.intent.name())
        .collect::<Vec<_>>()
        .join("+")
}

fn alts<'a>(r: &'a Row, key: &str) -> Vec<&'a str> {
    r.alt
        .split(';')
        .filter_map(|a| a.strip_prefix(key))
        .collect()
}

fn alt_intents(r: &Row) -> Vec<&str> {
    r.alt
        .split(';')
        .map(|a| a.strip_prefix("intent=").unwrap_or(a))
        .filter(|a| !a.is_empty() && !a.contains(':') && *a != "ask")
        .collect()
}

fn intent_ok(r: &Row, os: &[Outcome]) -> bool {
    let got = joined(os);
    if got != r.intent && !alt_intents(r).contains(&got.as_str()) {
        return false;
    }
    r.number.is_empty()
        || os
            .iter()
            .any(|o| o.parsed.number.map(|n| n.to_string()) == Some(r.number.clone()))
}

fn entity_matches(e: &voice_resolve::Entity, kind: &str, want: &str) -> bool {
    (e.name == want || e.label() == want) && (kind.is_empty() || e.kind.name() == kind)
}

fn entity_ok(r: &Row, os: &[Outcome]) -> bool {
    let wants: Vec<&str> = r.entity.split('+').collect();
    let kinds: Vec<&str> = r.kind.split('+').collect();
    let slots: Vec<usize> = if wants.len() > 1 {
        (0..os.len()).collect()
    } else {
        os.iter()
            .position(|o| o.intent.needs_entity())
            .into_iter()
            .collect()
    };
    if slots.is_empty() || (wants.len() > 1 && wants.len() != os.len()) {
        return false;
    }
    slots.iter().enumerate().all(|(n, &i)| {
        let Some(e) = top_entity(&os[i]) else {
            return false;
        };
        let want = wants.get(n).copied().unwrap_or("");
        let kind = kinds.get(n).or(kinds.first()).copied().unwrap_or("");
        if entity_matches(e, kind, want) {
            return true;
        }
        alts(r, "")
            .iter()
            .filter_map(|a| a.split_once(':'))
            .any(|(k, v)| entity_matches(e, k, v))
    })
}

fn run(
    name: &str,
    data: &[Row],
    catalog: &FixtureCatalog,
    bare: Bare,
) -> (BTreeMap<String, Stat>, Vec<String>) {
    let mut stats: BTreeMap<String, Stat> = BTreeMap::new();
    let mut failures = Vec::new();
    let names = Names::new(&VOICE);
    for r in data {
        let os = interpret(&r.phrase, catalog, &Boosts::none(), bare, &names);
        let s = stats.entry(r.category.clone()).or_default();
        s.rows += 1;
        let i_ok = intent_ok(r, &os);
        if i_ok {
            s.intent_ok += 1;
        }
        let mut e_ok = true;
        if !r.entity.is_empty() {
            s.entity_rows += 1;
            e_ok = i_ok && entity_ok(r, &os);
            if e_ok {
                s.entity_ok += 1;
            }
            if os
                .iter()
                .any(|o| matches!(o.decision, Some(Decision::Ask { .. })))
            {
                s.asks += 1;
            }
        }
        let mut false_act = false;
        if r.intent == "none"
            && os.iter().any(|o| o.acts())
            && !alt_intents(r).contains(&joined(&os).as_str())
        {
            s.false_acts += 1;
            false_act = true;
        }
        if !i_ok || !e_ok || false_act {
            let got: Vec<String> = os
                .iter()
                .map(|o| {
                    format!(
                        "{}/{:?}/{}",
                        o.intent.name(),
                        o.parsed.number,
                        top_entity(o).map(|e| e.label()).unwrap_or_default()
                    )
                })
                .collect();
            failures.push(format!(
                "{} [{}] {:?} want {}/{}/{}/{} got {} norm={:?}",
                name,
                r.category,
                r.phrase,
                r.intent,
                r.kind,
                r.entity,
                r.number,
                got.join(" + "),
                os.first().map(|o| o.parsed.normalized.clone())
            ));
        }
    }
    (stats, failures)
}

fn pct(a: usize, b: usize) -> f64 {
    if b == 0 {
        100.0
    } else {
        a as f64 * 100.0 / b as f64
    }
}

fn line(name: &str, s: &Stat) -> String {
    format!(
        "{:<16}{:>6}{:>10.1}{:>10.1}{:>7}{:>8}\n",
        name,
        s.rows,
        pct(s.intent_ok, s.rows),
        pct(s.entity_ok, s.entity_rows),
        s.asks,
        s.false_acts
    )
}

fn report(stats: &BTreeMap<String, Stat>) -> String {
    let mut out = format!(
        "{:<16}{:>6}{:>10}{:>10}{:>7}{:>8}\n",
        "category", "rows", "intent%", "entity%", "asks", "falseact"
    );
    let mut total = Stat::default();
    for (cat, s) in stats {
        out.push_str(&line(cat, s));
        total.add(s);
    }
    out.push_str(&line("TOTAL", &total));
    out
}

fn check(label: &str, stats: &BTreeMap<String, Stat>) -> Vec<String> {
    let mut bad = Vec::new();
    let mut total = Stat::default();
    for (cat, s) in stats {
        total.add(s);
        if pct(s.intent_ok, s.rows) < 95.0 {
            bad.push(format!(
                "{label}/{cat}: intent {:.1}% < 95",
                pct(s.intent_ok, s.rows)
            ));
        }
        if s.entity_rows > 0 && pct(s.entity_ok, s.entity_rows) < 90.0 {
            bad.push(format!(
                "{label}/{cat}: entity {:.1}% < 90",
                pct(s.entity_ok, s.entity_rows)
            ));
        }
        if s.false_acts > 0 {
            bad.push(format!("{label}/{cat}: {} false acts", s.false_acts));
        }
    }
    if pct(total.intent_ok, total.rows) < 98.0 {
        bad.push(format!(
            "{label}: overall intent {:.1}% < 98",
            pct(total.intent_ok, total.rows)
        ));
    }
    if pct(total.entity_ok, total.entity_rows) < 95.0 {
        bad.push(format!(
            "{label}: overall entity {:.1}% < 95",
            pct(total.entity_ok, total.entity_rows)
        ));
    }
    bad
}

fn merge(into: &mut BTreeMap<String, Stat>, from: &BTreeMap<String, Stat>) {
    for (k, v) in from {
        into.entry(k.clone()).or_default().add(v);
    }
}

#[test]
fn targets_with_aliases() {
    let catalog = FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), true);
    let mut union = BTreeMap::new();
    let mut bad = Vec::new();
    let mut failures = Vec::new();
    for set in sets() {
        let (stats, f) = run(set.name, &set.rows, &catalog, Bare::Popular);
        println!("set {}\n{}", set.name, report(&stats));
        bad.extend(check(set.name, &stats));
        merge(&mut union, &stats);
        failures.extend(f);
    }
    println!("all sets\n{}", report(&union));
    for f in &failures {
        println!("{f}");
    }
    bad.extend(check("all", &union));
    assert!(bad.is_empty(), "under target: {bad:#?}");
}

#[test]
fn targets_without_catalog_aliases() {
    let catalog = FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), false);
    let mut union = BTreeMap::new();
    let mut failures = Vec::new();
    for set in sets() {
        let (stats, f) = run(set.name, &set.rows, &catalog, Bare::Popular);
        merge(&mut union, &stats);
        failures.extend(f);
    }
    println!("without catalog aliases, all sets\n{}", report(&union));
    for f in &failures {
        println!("{f}");
    }
    let mut total = Stat::default();
    for s in union.values() {
        total.add(s);
    }
    let entity = pct(total.entity_ok, total.entity_rows);
    assert!(entity >= 97.0, "entity {entity:.1}% < 97");
}

fn named_alone(o: &Outcome) -> bool {
    o.parsed.intent == Intent::None && o.intent == Intent::Play
}

fn understood(os: &[Outcome]) -> Vec<String> {
    os.iter()
        .map(|o| format!("{:?} {:?} {:?}", o.intent, o.parsed, o.decision))
        .collect()
}

#[test]
fn leaving_names_said_alone_to_the_listener_changes_nothing_else() {
    let catalog = FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), true);
    let mut union = BTreeMap::new();
    let mut left = Vec::new();
    let names = Names::new(&VOICE);
    for set in sets() {
        let (stats, _) = run(set.name, &set.rows, &catalog, Bare::Certain);
        merge(&mut union, &stats);
        for row in &set.rows {
            let read = |bare| interpret(&row.phrase, &catalog, &Boosts::none(), bare, &names);
            let popular = read(Bare::Popular);
            let certain = read(Bare::Certain);
            for o in certain.iter().filter(|o| named_alone(o)) {
                assert!(o.acts(), "{} plays {:?}", row.phrase, o.decision);
            }
            for o in &popular {
                assert!(o.candidates.is_empty(), "{}", row.phrase);
            }
            if understood(&popular) == understood(&certain) {
                continue;
            }
            assert!(popular.iter().any(named_alone), "{}", row.phrase);
            left.push(format!("{} [{}] {:?}", set.name, row.category, row.phrase));
        }
    }
    println!(
        "names said alone are left to the listener, all sets\n{}",
        report(&union)
    );
    println!("{} phrases are understood differently", left.len());
    for phrase in &left {
        println!("{phrase}");
    }
}
