use std::io::BufRead;
use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Catalog, FixtureCatalog, interpret, rank};

fn main() {
    let path = std::env::var("CATALOG").ok();
    let text = match path {
        Some(p) => std::fs::read_to_string(p).expect("catalog file"),
        None => include_str!("../tests/data/catalog.tsv").to_string(),
    };
    let aliases = std::env::var("NO_ALIASES").is_err();
    let catalog = FixtureCatalog::from_tsv(&text, aliases);
    let boosts = Boosts::none();
    let bare = match std::env::var("CHAT") {
        Ok(_) => Bare::Certain,
        Err(_) => Bare::Popular,
    };
    let said = std::env::var("NAMES").unwrap_or_default();
    let names = Names::new(&said.split(',').collect::<Vec<_>>());

    let args: Vec<String> = std::env::args().skip(1).collect();
    let phrases: Vec<String> = if args.is_empty() {
        std::io::stdin()
            .lock()
            .lines()
            .map_while(Result::ok)
            .collect()
    } else {
        args
    };
    for phrase in phrases.iter().filter(|p| !p.trim().is_empty()) {
        let steps = interpret(phrase, &catalog, &boosts, bare, &names);
        let line = serde_json::json!({ "phrase": phrase, "steps": steps });
        println!("{line}");
        if std::env::var("TOP").is_ok() {
            for p in voice_nlu::parse(phrase, &names) {
                let cands = catalog.candidates(&p.queries, &voice_nlu::Kind::ALL);
                for r in rank(&p, cands, &boosts).iter().take(3) {
                    eprintln!(
                        "  {} sim={:.2} score={:.2}",
                        r.entity.label(),
                        r.sim,
                        r.score
                    );
                }
            }
        }
    }
}
