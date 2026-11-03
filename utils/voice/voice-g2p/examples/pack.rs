use fst::MapBuilder;
use std::fs::{read_to_string, write, File};
use std::io::BufWriter;

fn rows(path: &str) -> Vec<(String, String)> {
    read_to_string(path)
        .unwrap()
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect()
}

fn build(rows: Vec<(String, u64)>, out: &str) {
    let mut b = MapBuilder::new(BufWriter::new(File::create(out).unwrap())).unwrap();
    for (k, v) in rows {
        b.insert(k, v).unwrap();
    }
    b.finish().unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (src, dst) = (&args[1], &args[2]);

    let stress = rows(&format!("{src}/ru-stress.tsv"))
        .into_iter()
        .map(|(k, v)| {
            let pos: Vec<u64> = v.split(',').map(|p| p.parse().unwrap()).collect();
            let mut value = (pos.len() as u64) << 24;
            for (i, p) in pos.iter().enumerate() {
                value |= p << (8 * i);
            }
            (k, value)
        })
        .collect();
    build(stress, &format!("{dst}/ru-stress.fst"));

    for name in ["yo", "suffix"] {
        let rows = rows(&format!("{src}/ru-{name}.tsv"))
            .into_iter()
            .map(|(k, v)| (k, v.parse().unwrap()))
            .collect();
        build(rows, &format!("{dst}/ru-{name}.fst"));
    }

    if std::path::Path::new(&format!("{src}/en-us.tsv")).exists() {
        let mut blob = Vec::new();
        let mut entries = Vec::new();
        for (word, ph) in rows(&format!("{src}/en-us.tsv")) {
            let value = ((blob.len() as u64) << 16) | ph.len() as u64;
            blob.extend_from_slice(ph.as_bytes());
            entries.push((word, value));
        }
        build(entries, &format!("{dst}/en-us.fst"));
        write(format!("{dst}/en-us.ph"), blob).unwrap();
    }
}
