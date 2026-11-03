use std::io::BufRead;
use voice_resolve::{interpret, Boosts, FixtureCatalog};

fn main() {
    let path = std::env::var("CATALOG").ok();
    let text = match path {
        Some(p) => std::fs::read_to_string(p).expect("catalog file"),
        None => include_str!("../tests/data/catalog.tsv").to_string(),
    };
    let aliases = std::env::var("NO_ALIASES").is_err();
    let catalog = FixtureCatalog::from_tsv(&text, aliases);
    let boosts = Boosts::none();

    let args: Vec<String> = std::env::args().skip(1).collect();
    let phrases: Vec<String> = if args.is_empty() {
        std::io::stdin().lock().lines().map_while(Result::ok).collect()
    } else {
        args
    };
    for phrase in phrases.iter().filter(|p| !p.trim().is_empty()) {
        let outcome = interpret(phrase, &catalog, &boosts);
        let line = serde_json::json!({ "phrase": phrase, "outcome": outcome });
        println!("{line}");
    }
}
