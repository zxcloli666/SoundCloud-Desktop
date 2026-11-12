use std::collections::HashMap;
use std::sync::OnceLock;
use voice_nlu::{Kind, Variant, fold};

const DATA: &str = include_str!("../data/aliases.tsv");
const SAME_WORD: f32 = 0.85;
const VERSIONS: &[&str] = &[
    "караоке",
    "пиано",
    "трибьют",
    "кавер",
    "ремикс",
    "акустика",
    "инструментал",
    "минусовка",
    "karaoke",
    "piano",
    "tribute",
    "cover",
    "remix",
    "acoustic",
    "instrumental",
];

struct Alias {
    canonical: String,
    kind: Kind,
}

fn table() -> &'static HashMap<String, Vec<Alias>> {
    static TABLE: OnceLock<HashMap<String, Vec<Alias>>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let mut map: HashMap<String, Vec<Alias>> = HashMap::new();
        for line in DATA.lines().skip(1) {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 3 {
                continue;
            }
            let Some(kind) = Kind::from_name(cols[2].trim()) else {
                continue;
            };
            let key = fold(cols[0]);
            if key.is_empty() {
                continue;
            }
            map.entry(key).or_default().push(Alias {
                canonical: cols[1].trim().to_string(),
                kind,
            });
        }
        map
    })
}

fn aliased(v: &Variant, kind: Kind, text: String, parts: Option<(&str, &str)>) -> Variant {
    let mut out = v.clone();
    out.alias_kind = Some(kind);
    out.text = text;
    out.artist = parts.map(|(artist, _)| artist.to_string());
    out.title = parts.map(|(_, title)| title.to_string());
    out
}

fn track_parts(canonical: &str) -> Option<(&str, &str)> {
    canonical.split_once(" - ")
}

fn titled(v: &Variant, a: &Alias, artist: &str, title: &str) -> Variant {
    aliased(
        v,
        a.kind,
        format!("{title} {artist}"),
        Some((artist, title)),
    )
}

fn with_rest(v: &Variant, canonical: &str, rest: &str) -> Variant {
    if voice_nlu::similarity(&fold(rest), &fold(canonical)) >= 0.8 {
        return aliased(v, Kind::Artist, canonical.to_string(), None);
    }
    aliased(
        v,
        Kind::Artist,
        format!("{rest} {canonical}"),
        Some((canonical, rest)),
    )
}

fn expand_one(v: &Variant, out: &mut Vec<Variant>) {
    let table = table();
    for a in table.get(&fold(&v.text)).into_iter().flatten() {
        match track_parts(&a.canonical) {
            Some((artist, title)) if a.kind != Kind::Artist => {
                out.push(titled(v, a, artist, title))
            }
            _ => out.push(aliased(v, a.kind, a.canonical.clone(), None)),
        }
    }
    if let (Some(artist), Some(title)) = (&v.artist, &v.title) {
        for a in table.get(&fold(artist)).into_iter().flatten() {
            if a.kind == Kind::Artist {
                out.push(with_rest(v, &a.canonical, title));
            }
        }
    }
    let words: Vec<&str> = v.text.split_whitespace().collect();
    for k in 1..=3.min(words.len().saturating_sub(1)) {
        let head = (words[..k].join(" "), words[k..].join(" "));
        let tail = (
            words[words.len() - k..].join(" "),
            words[..words.len() - k].join(" "),
        );
        for (part, rest) in [head, tail] {
            for a in table.get(&fold(&part)).into_iter().flatten() {
                match track_parts(&a.canonical) {
                    None if a.kind == Kind::Artist => out.push(with_rest(v, &a.canonical, &rest)),
                    Some((artist, title))
                        if a.kind == Kind::Track
                            && voice_nlu::similarity(&fold(&rest), &fold(artist)) >= 0.6 =>
                    {
                        out.push(titled(v, a, artist, title))
                    }
                    Some((_, title)) if a.kind == Kind::Track && names_a_version(&rest) => {
                        out.push(titled(v, a, &rest, title))
                    }
                    _ => {}
                }
            }
        }
    }
}

fn names_a_version(said: &str) -> bool {
    let heard = fold(said);
    VERSIONS
        .iter()
        .any(|word| voice_nlu::similarity(&heard, &fold(word)) >= SAME_WORD)
}

fn disabled() -> bool {
    static OFF: OnceLock<bool> = OnceLock::new();
    *OFF.get_or_init(|| std::env::var_os("VOICE_NO_CURATED").is_some())
}

pub fn expand(variants: &[Variant]) -> Vec<Variant> {
    let mut out: Vec<Variant> = variants.to_vec();
    if disabled() {
        return out;
    }
    for v in variants.iter().filter(|v| v.alias_kind.is_none()) {
        let mut found = Vec::new();
        expand_one(v, &mut found);
        for x in found {
            if !out.contains(&x) {
                out.push(x);
            }
        }
    }
    out
}
