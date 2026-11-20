use std::collections::BTreeMap;
use voice_g2p::ru::{Data, Russian, Source};

fn main() {
    let path = std::env::args().nth(1).unwrap();
    let ru = match std::env::args().nth(2) {
        Some(dir) => Russian::new(Data::from_dir(std::path::Path::new(&dir)).unwrap()),
        None => Russian::bundled(),
    };
    let mut sources: BTreeMap<String, usize> = BTreeMap::new();
    let mut unknown: BTreeMap<String, usize> = BTreeMap::new();
    let mut marked = 0;
    let mut first_ok = 0;
    let mut any_ok = 0;
    let mut missing = Vec::new();
    let mut wrong = Vec::new();
    for line in std::fs::read_to_string(path).unwrap().lines().skip(1) {
        let text = line.split('\t').nth(2).unwrap();
        let plain = text.replace('+', "");
        for (word, source) in ru.speak(&plain).words {
            *sources.entry(format!("{source:?}")).or_default() += 1;
            if source == Source::Guess {
                *unknown.entry(word).or_default() += 1;
            }
        }
        for raw in text.split(|c: char| !(c.is_alphabetic() || c == '+' || c == '-')) {
            if !raw.contains('+') {
                continue;
            }
            marked += 1;
            let want = ru.stress(raw);
            let got = ru.stress(&raw.replace('+', ""));
            let word: String = want.letters.iter().collect();
            if got.stress == want.stress {
                first_ok += 1;
                any_ok += 1;
            } else if got.alternatives.contains(&want.stress.unwrap()) {
                any_ok += 1;
                wrong.push(format!("{word} (alt)"));
            } else {
                missing.push(format!("{word}:{:?}->{:?}/{:?}", want.stress, got.stress, got.source));
            }
        }
    }
    let total: usize = sources.values().sum();
    println!("words {total}");
    for (k, v) in &sources {
        println!("  {k}: {v} ({:.2}%)", *v as f64 * 100.0 / total as f64);
    }
    println!("marked words {marked}: first choice ok {first_ok}, any variant ok {any_ok}");
    println!("alt-only: {}", wrong.join(" "));
    println!("wrong or missing: {}", missing.join(" "));
    let mut unk: Vec<_> = unknown.into_iter().collect();
    unk.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
    println!("guessed distinct {}: {}", unk.len(), unk.iter().take(60).map(|(w, n)| format!("{w}x{n}")).collect::<Vec<_>>().join(" "));
}
