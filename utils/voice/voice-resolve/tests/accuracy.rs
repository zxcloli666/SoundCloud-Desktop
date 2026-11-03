use std::collections::BTreeMap;
use voice_resolve::{interpret, Boosts, Decision, FixtureCatalog, Outcome};

struct Row {
    phrase: String,
    intent: String,
    kind: String,
    entity: String,
    number: String,
    category: String,
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
            }
        })
        .collect()
}

#[derive(Default)]
struct Stat {
    rows: usize,
    intent_ok: usize,
    entity_rows: usize,
    entity_ok: usize,
    asks: usize,
    negatives: usize,
    false_acts: usize,
}

fn top_entity(o: &Outcome) -> Option<&voice_resolve::Entity> {
    match o.decision.as_ref()? {
        Decision::Act { pick } => Some(&pick.entity),
        Decision::Ask { first, .. } => Some(&first.entity),
        Decision::NotFound => None,
    }
}

fn intent_ok(r: &Row, o: &Outcome) -> bool {
    if o.intent.name() != r.intent {
        return false;
    }
    r.number.is_empty() || o.parsed.number.map(|n| n.to_string()) == Some(r.number.clone())
}

fn entity_ok(r: &Row, o: &Outcome) -> bool {
    let Some(e) = top_entity(o) else { return false };
    let named = e.name == r.entity || e.label() == r.entity;
    named && (r.kind.is_empty() || e.kind.name() == r.kind)
}

fn run(data: &[Row], catalog: &FixtureCatalog) -> (BTreeMap<String, Stat>, Vec<String>) {
    let mut stats: BTreeMap<String, Stat> = BTreeMap::new();
    let mut failures = Vec::new();
    for r in data {
        let o = interpret(&r.phrase, catalog, &Boosts::none());
        let s = stats.entry(r.category.clone()).or_default();
        s.rows += 1;
        let i_ok = intent_ok(r, &o);
        if i_ok {
            s.intent_ok += 1;
        }
        let mut e_ok = true;
        if !r.entity.is_empty() {
            s.entity_rows += 1;
            e_ok = i_ok && entity_ok(r, &o);
            if e_ok {
                s.entity_ok += 1;
            }
            if matches!(o.decision, Some(Decision::Ask { .. })) {
                s.asks += 1;
            }
        }
        let mut false_act = false;
        if r.intent == "none" {
            s.negatives += 1;
            if o.acts() {
                s.false_acts += 1;
                false_act = true;
            }
        }
        if !i_ok || !e_ok || false_act {
            let got = top_entity(&o).map(|e| e.label()).unwrap_or_default();
            failures.push(format!(
                "[{}] {:?} want {}/{}/{}/{} got {}/{:?}/{} norm={:?}",
                r.category,
                r.phrase,
                r.intent,
                r.kind,
                r.entity,
                r.number,
                o.intent.name(),
                o.parsed.number,
                got,
                o.parsed.normalized
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

fn report(stats: &BTreeMap<String, Stat>) -> String {
    let mut out = String::new();
    out.push_str(&format!(
        "{:<14}{:>6}{:>10}{:>10}{:>7}{:>8}\n",
        "category", "rows", "intent%", "entity%", "asks", "falseact"
    ));
    let mut total = Stat::default();
    for (cat, s) in stats {
        out.push_str(&format!(
            "{:<14}{:>6}{:>10.1}{:>10.1}{:>7}{:>8}\n",
            cat,
            s.rows,
            pct(s.intent_ok, s.rows),
            pct(s.entity_ok, s.entity_rows),
            s.asks,
            s.false_acts
        ));
        total.rows += s.rows;
        total.intent_ok += s.intent_ok;
        total.entity_rows += s.entity_rows;
        total.entity_ok += s.entity_ok;
        total.asks += s.asks;
        total.false_acts += s.false_acts;
    }
    out.push_str(&format!(
        "{:<14}{:>6}{:>10.1}{:>10.1}{:>7}{:>8}\n",
        "TOTAL",
        total.rows,
        pct(total.intent_ok, total.rows),
        pct(total.entity_ok, total.entity_rows),
        total.asks,
        total.false_acts
    ));
    out
}

fn check(stats: &BTreeMap<String, Stat>) -> Vec<String> {
    let mut bad = Vec::new();
    let (mut rows, mut i_ok, mut e_rows, mut e_ok) = (0, 0, 0, 0);
    for (cat, s) in stats {
        rows += s.rows;
        i_ok += s.intent_ok;
        e_rows += s.entity_rows;
        e_ok += s.entity_ok;
        if pct(s.intent_ok, s.rows) < 95.0 {
            bad.push(format!("{cat}: intent {:.1}% < 95", pct(s.intent_ok, s.rows)));
        }
        if s.entity_rows > 0 && pct(s.entity_ok, s.entity_rows) < 90.0 {
            bad.push(format!("{cat}: entity {:.1}% < 90", pct(s.entity_ok, s.entity_rows)));
        }
        if s.false_acts > 0 {
            bad.push(format!("{cat}: {} false acts", s.false_acts));
        }
    }
    if pct(i_ok, rows) < 98.0 {
        bad.push(format!("overall intent {:.1}% < 98", pct(i_ok, rows)));
    }
    if pct(e_ok, e_rows) < 95.0 {
        bad.push(format!("overall entity {:.1}% < 95", pct(e_ok, e_rows)));
    }
    bad
}

fn load() -> Vec<Row> {
    let mut all = rows(include_str!("data/phrases.tsv"));
    all.extend(rows(include_str!("data/phrases_dev.tsv")));
    all.extend(rows(include_str!("data/phrases_dev2.tsv")));
    all
}

#[test]
fn targets_with_aliases() {
    let catalog = FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), true);
    let (stats, failures) = run(&load(), &catalog);
    let table = report(&stats);
    let bad = check(&stats);
    println!("{table}");
    for f in &failures {
        println!("{f}");
    }
    assert!(bad.is_empty(), "\n{table}\nunder target: {bad:?}\n{}", failures.join("\n"));
}

#[test]
fn names_without_aliases() {
    let catalog = FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), false);
    let (stats, failures) = run(&load(), &catalog);
    println!("without aliases\n{}", report(&stats));
    for f in &failures {
        println!("{f}");
    }
}
