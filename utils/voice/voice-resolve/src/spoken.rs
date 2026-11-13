use voice_nlu::{Parsed, Variant, fold, normalize};

pub(crate) const WORDS: usize = 6;
const ASKING: &[&str] = &["пожалуйста", "пожалуста", "пжлст", "плиз", "pls"];
const THANKING: &[&str] = &["спасибо", "please", "thanks"];

struct Cut {
    said: String,
    left: String,
    at: usize,
    words: usize,
}

pub(crate) fn words(heard: &str) -> Vec<String> {
    let words = heard.split_whitespace().map(bare);
    words.filter(|word| !word.is_empty()).collect()
}

fn bare(word: &str) -> String {
    let word = word.trim_matches(|c: char| !c.is_alphanumeric());
    word.to_lowercase()
}

pub(crate) fn cleaned(said: &str) -> Option<String> {
    let left = normalize(said).text;
    (!left.is_empty() && fold(&left) != fold(said)).then_some(left)
}

fn shortened(said: &str) -> Option<String> {
    let left = normalize(said).text;
    let count = |text: &str| text.split_whitespace().count();
    let cut = fold(&left) != fold(said) || count(&left) < count(said);
    (cut && !left.is_empty()).then_some(left)
}

pub(crate) fn uncut(parsed: &Parsed) -> Vec<Variant> {
    let heard = |v: &&Variant| !v.lemmatized && !v.fallback && v.alias_kind.is_none();
    let said: Vec<&Variant> = parsed.queries.iter().filter(heard).collect();
    if said.is_empty() {
        return Vec::new();
    }
    let cuts = cuts(&words(&parsed.heard));
    if said.iter().any(|v| v.artist.is_some() && v.title.is_some()) {
        return said.iter().filter_map(|v| in_parts(v, &cuts)).collect();
    }
    said.iter().filter_map(|v| whole(v, &cuts)).collect()
}

fn whole(v: &Variant, cuts: &[Cut]) -> Option<Variant> {
    Some(Variant {
        text: as_said(&v.text, cuts)?,
        kept_fillers: true,
        ..v.clone()
    })
}

fn in_parts(v: &Variant, cuts: &[Cut]) -> Option<Variant> {
    let (artist, title) = (v.artist.as_ref()?, v.title.as_ref()?);
    let (said_artist, said_title) = (as_said(artist, cuts), as_said(title, cuts));
    if said_artist.is_none() && said_title.is_none() {
        return None;
    }
    let artist = said_artist.unwrap_or_else(|| artist.clone());
    let title = said_title.unwrap_or_else(|| title.clone());
    Some(Variant {
        text: format!("{title} {artist}"),
        artist: Some(artist),
        title: Some(title),
        kept_fillers: true,
        ..v.clone()
    })
}

fn as_said(text: &str, cuts: &[Cut]) -> Option<String> {
    let named = cuts.iter().filter(|cut| cut.left == text);
    let cut = named.min_by_key(|cut| (cut.at, cut.words))?;
    Some(cut.said.clone())
}

fn cuts(words: &[String]) -> Vec<Cut> {
    if shortened(&words.join(" ")).is_none() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for len in 1..=WORDS.min(words.len()) {
        let spans = words.windows(len).enumerate();
        for (at, span) in spans.filter(|(_, span)| !courteous(span)) {
            let said = span.join(" ");
            if let Some(left) = shortened(&said) {
                out.push(Cut {
                    said,
                    left,
                    at,
                    words: len,
                });
            }
        }
    }
    out
}

fn courteous(span: &[String]) -> bool {
    let among =
        |list: &[&str], word: Option<&String>| word.is_some_and(|w| list.contains(&w.as_str()));
    among(ASKING, span.first()) || among(ASKING, span.last()) || among(THANKING, span.last())
}
