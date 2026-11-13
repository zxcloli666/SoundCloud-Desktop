use std::collections::HashMap;
use std::sync::OnceLock;
use voice_nlu::{Kind, Parsed, Variant, fold, lemma};

use crate::spoken;

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
    words: usize,
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
                words: word_count(cols[0]),
            });
        }
        map
    })
}

fn artists() -> &'static HashMap<String, &'static str> {
    static ARTISTS: OnceLock<HashMap<String, &'static str>> = OnceLock::new();
    ARTISTS.get_or_init(|| {
        let rows = DATA.lines().skip(1).map(|line| line.split('\t'));
        rows.filter_map(|mut cols| {
            let canonical = cols.nth(1)?.trim();
            let kind = Kind::from_name(cols.next()?.trim())?;
            (kind == Kind::Artist).then(|| (fold(canonical), canonical))
        })
        .collect()
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

fn named_as_said(parsed: &Parsed, out: &mut Vec<Variant>) {
    let words = spoken::words(&parsed.heard);
    for len in (1..=spoken::WORDS.min(words.len())).rev() {
        for span in words.windows(len) {
            let mut forms: Vec<String> = (0..=2).map(|by| lemmatized(span, by)).collect();
            forms.dedup();
            let said = span.join(" ");
            let count = Some(word_count(&said));
            let mut named = Vec::new();
            for form in forms {
                named_by(&as_said(form.clone()), &fold(&form), count, &mut named);
            }
            if !named.is_empty() && cut_from(&said, &parsed.normalized) {
                out.extend(named);
            }
        }
    }
}

fn word_count(text: &str) -> usize {
    let words = text.split(|c: char| !c.is_alphanumeric());
    words.filter(|word| !word.is_empty()).count()
}

fn lemmatized(words: &[String], strategy: u8) -> String {
    let words: Vec<String> = words.iter().map(|w| lemma(w, strategy)).collect();
    words.join(" ")
}

fn cut_from(said: &str, cleaned: &str) -> bool {
    let within = |left: String| format!(" {cleaned} ").contains(&format!(" {left} "));
    spoken::cleaned(said).is_some_and(within)
}

fn as_said(text: String) -> Variant {
    Variant {
        text,
        artist: None,
        title: None,
        kept_fillers: false,
        lemmatized: false,
        fallback: false,
        alias_kind: None,
    }
}

fn named_whole(v: &Variant, out: &mut Vec<Variant>) {
    named_by(v, &fold(&v.text), None, out);
}

fn named_by(v: &Variant, said: &str, words: Option<usize>, out: &mut Vec<Variant>) {
    let fits = |count: usize| words.is_none_or(|said| said == count);
    let rows = table().get(said).into_iter().flatten();
    for a in rows.filter(|a| fits(a.words)) {
        match track_parts(&a.canonical) {
            Some((artist, title)) if a.kind != Kind::Artist => {
                out.push(titled(v, a, artist, title))
            }
            _ => out.push(aliased(v, a.kind, a.canonical.clone(), None)),
        }
    }
    let own = artists().get(said);
    if let Some(own) = own.filter(|own| fits(word_count(own))) {
        out.push(aliased(v, Kind::Artist, own.to_string(), None));
    }
}

fn named_in_part(v: &Variant, out: &mut Vec<Variant>) {
    let table = table();
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

pub fn expand(parsed: &Parsed) -> Vec<Variant> {
    let variants = &parsed.queries;
    if disabled() {
        return variants.to_vec();
    }
    let mut whole = Vec::new();
    let mut in_part = Vec::new();
    named_as_said(parsed, &mut whole);
    for v in variants.iter().filter(|v| v.alias_kind.is_none()) {
        named_whole(v, &mut whole);
        named_in_part(v, &mut in_part);
    }
    let mut out: Vec<Variant> = Vec::new();
    for v in whole
        .into_iter()
        .chain(spoken::uncut(parsed))
        .chain(variants.iter().cloned())
        .chain(in_part)
    {
        if !out.contains(&v) {
            out.push(v);
        }
    }
    out
}
