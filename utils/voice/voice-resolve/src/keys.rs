use crate::entity::Entity;
use voice_nlu::{Kind, Variant, fold, skeleton, word_ends};

type Grams = Vec<(char, char)>;

fn grams(key: &str) -> Grams {
    let sk: Vec<char> = skeleton(key).chars().collect();
    let mut out: Grams = sk.windows(2).map(|w| (w[0], w[1])).collect();
    out.sort();
    out.dedup();
    out
}

fn dice(a: &Grams, b: &Grams) -> f32 {
    if a.is_empty() || b.is_empty() {
        return 1.0;
    }
    let (mut i, mut j, mut shared) = (0, 0, 0);
    while i < a.len() && j < b.len() {
        match a[i].cmp(&b[j]) {
            std::cmp::Ordering::Equal => {
                shared += 1;
                i += 1;
                j += 1;
            }
            std::cmp::Ordering::Less => i += 1,
            std::cmp::Ordering::Greater => j += 1,
        }
    }
    2.0 * shared as f32 / (a.len() + b.len()) as f32
}

pub struct Keys {
    grams: Vec<Grams>,
    name_grams: Vec<Grams>,
    names: Vec<(String, f32)>,
    artist: Option<String>,
    artist_parts: Vec<String>,
    own_artist_name: bool,
    kind: Kind,
}

fn credits(name: &str) -> Vec<String> {
    let mut parts = vec![name.to_string()];
    for sep in [
        " & ", " feat. ", " feat ", " ft. ", " x ", ", ", " и ", " and ",
    ] {
        if name.contains(sep) {
            parts = parts
                .iter()
                .flat_map(|p| {
                    p.split(sep)
                        .map(|s| s.trim().to_string())
                        .collect::<Vec<_>>()
                })
                .collect();
        }
    }
    if parts.len() == 1 {
        parts.clear();
    }
    parts
}

fn name_words(name: &str) -> Vec<&str> {
    let words: Vec<&str> = name
        .split(|c: char| c.is_whitespace() || c == '-')
        .filter(|w| !w.is_empty())
        .collect();
    if words.len() < 2 {
        return Vec::new();
    }
    words
        .into_iter()
        .filter(|w| w.chars().count() >= 4 && w.chars().all(char::is_alphabetic))
        .collect()
}

fn without_parens(name: &str) -> Option<String> {
    let open = name.find('(')?;
    let head = name[..open].trim();
    (!head.is_empty()).then(|| head.to_string())
}

impl Keys {
    pub fn new(e: &Entity) -> Keys {
        let mut names = vec![(fold(&e.name), 1.0)];
        if let Some(head) = without_parens(&e.name) {
            names.push((fold(&head), 1.0));
        }
        for a in &e.aliases {
            names.push((fold(a), CALLED));
        }
        if e.kind == Kind::Artist {
            for part in credits(&e.name) {
                names.push((fold(&part), 0.95));
            }
            for word in name_words(&e.name) {
                names.push((fold(word), ONE_WORD));
            }
        }
        names.retain(|(k, _)| !k.is_empty());
        let artist = e.artist.as_deref().map(fold);
        let mut all = Vec::new();
        let mut name_grams = Vec::new();
        for (n, _) in &names {
            name_grams.push(grams(n));
            all.push(grams(n));
            if let Some(a) = &artist {
                all.push(grams(&format!("{a}{n}")));
                all.push(grams(&format!("{n}{a}")));
            }
        }
        Keys {
            grams: all,
            name_grams,
            names,
            artist: e.artist.as_deref().map(fold),
            artist_parts: e
                .artist
                .as_deref()
                .map(|a| {
                    credits(a)
                        .iter()
                        .map(|p| fold(p))
                        .chain(name_words(a).into_iter().map(fold))
                        .chain(e.artist_aliases.iter().map(|x| fold(x)))
                        .collect()
                })
                .unwrap_or_default(),
            own_artist_name: e.kind == Kind::Artist,
            kind: e.kind,
        }
    }

    fn plausible(&self, v: &QueryKeys) -> bool {
        if self.grams.iter().any(|g| dice(&v.grams, g) >= 0.2) {
            return true;
        }
        match &v.title_grams {
            Some(t) => self.name_grams.iter().any(|g| dice(t, g) >= 0.2),
            None => false,
        }
    }

    fn fallback_sim(&self, v: &QueryKeys) -> f32 {
        if !self.own_artist_name {
            return 0.0;
        }
        let weight = |w: f32| if w < CALLED { ONE_WORD } else { w };
        let best = self
            .names
            .iter()
            .map(|(name, w)| near(&v.text, name) * weight(*w))
            .fold(0.0f32, f32::max);
        best * FALLBACK_FACTOR
    }

    pub fn sim(&self, v: &QueryKeys) -> f32 {
        if !self.plausible(v) {
            return 0.0;
        }
        if v.alias_kind
            .is_some_and(|k| v.title.is_none() && k != self.kind)
        {
            return 0.0;
        }
        if v.fallback {
            return self.fallback_sim(v);
        }
        let mut best = 0.0f32;
        for (name, w) in &self.names {
            best = best.max(near(&v.text, name) * w);
            if let Some(artist) = &self.artist {
                best = best.max(combo(v, artist, name) * w);
                for part in &self.artist_parts {
                    best = best.max(combo(v, part, name) * w * 0.95);
                }
            }
        }
        if let (Some(qa), Some(qt)) = (&v.artist, &v.title) {
            let lone = if self.own_artist_name { 0.0 } else { 0.2 };
            let sa = self.by(qa).unwrap_or(lone);
            best = best.max(self.titled(qt) * (0.35 + 0.65 * sa));
        }
        if v.alias_kind.is_some() {
            best *= ALIAS_FACTOR;
        }
        if v.kept {
            best *= 1.06;
        }
        if v.lemmatized {
            best *= 0.96;
        }
        best
    }

    pub fn credited(&self, v: &QueryKeys) -> bool {
        let said = v.alias_kind.is_none_or(|kind| kind == Kind::Artist);
        let (Some(artist), Some(title), true) = (&v.artist, &v.title, said) else {
            return false;
        };
        let credits = |part: &String| self.by(part).is_some_and(|sim| sim >= CREDIT_MIN);
        credits(artist) || credits(title)
    }

    fn titled(&self, title: &str) -> f32 {
        let sims = self.names.iter().map(|(name, w)| near(title, name) * w);
        sims.fold(0.0f32, f32::max)
    }

    fn by(&self, artist: &str) -> Option<f32> {
        let whole = near(artist, self.artist.as_ref()?);
        let parts = self.artist_parts.iter().map(|p| near(artist, p) * 0.95);
        Some(parts.fold(whole, f32::max))
    }
}

const CALLED: f32 = 0.97;
const ONE_WORD: f32 = 0.9;
const STRICT_SLACK: f32 = 0.2;
const CREDIT_MIN: f32 = 0.88;
const FALLBACK_FACTOR: f32 = 0.92;
const ALIAS_FACTOR: f32 = 0.96;

pub fn near(a: &str, b: &str) -> f32 {
    voice_nlu::similarity(a, b).min(voice_nlu::strict_similarity(a, b) + STRICT_SLACK)
}

fn combo(query: &QueryKeys, artist: &str, name: &str) -> f32 {
    let q = query.text.as_str();
    let qc: Vec<char> = q.chars().collect();
    let total = qc.len();
    if total < 3 {
        return 0.0;
    }
    let close = near(q, &format!("{artist}{name}")).max(near(q, &format!("{name}{artist}")));
    if close < 0.5 {
        return 0.0;
    }
    let mut best = 0.0f32;
    for (first, second) in [(artist, name), (name, artist)] {
        let l1 = first.chars().count();
        let lo = l1.saturating_sub(3).max(1);
        let hi = (l1 + 3).min(total - 1);
        for p in (lo..=hi).filter(|p| query.meets_at(*p)) {
            let left: String = qc[..p].iter().collect();
            let right: String = qc[p..].iter().collect();
            let s1 = near(&left, first);
            let s2 = near(&right, second);
            if s1 < 0.6 || s2 < 0.6 {
                continue;
            }
            let (w1, w2) = (l1 as f32, second.chars().count() as f32);
            best = best.max((s1 * w1 + s2 * w2) / (w1 + w2));
        }
    }
    best
}

pub struct QueryKeys {
    pub text: String,
    pub artist: Option<String>,
    pub title: Option<String>,
    pub kept: bool,
    pub lemmatized: bool,
    pub fallback: bool,
    pub alias_kind: Option<Kind>,
    grams: Grams,
    title_grams: Option<Grams>,
    word_ends: Vec<usize>,
}

impl QueryKeys {
    pub fn new(v: &Variant) -> QueryKeys {
        let text = fold(&v.text);
        let title = v.title.as_deref().map(fold);
        QueryKeys {
            grams: grams(&text),
            title_grams: title.as_deref().map(grams),
            word_ends: word_ends(&v.text),
            text,
            artist: v.artist.as_deref().map(fold),
            title,
            kept: v.kept_fillers,
            lemmatized: v.lemmatized,
            fallback: v.fallback,
            alias_kind: v.alias_kind,
        }
    }

    fn meets_at(&self, split: usize) -> bool {
        self.word_ends.len() < 2 || self.word_ends.contains(&split)
    }

    pub fn edge_words(&self) -> Vec<String> {
        let chars: Vec<char> = self.text.chars().collect();
        let ends = &self.word_ends;
        if ends.len() < 2 {
            return Vec::new();
        }
        let first = ends[0].min(chars.len());
        let last = ends[ends.len() - 2].min(chars.len());
        vec![
            chars[..first].iter().collect(),
            chars[last..].iter().collect(),
        ]
    }

    pub fn names_an_artist(&self) -> bool {
        self.alias_kind == Some(Kind::Artist) && self.title.is_none() && !self.fallback
    }

    pub fn list(variants: &[Variant]) -> Vec<QueryKeys> {
        let mut out: Vec<QueryKeys> = Vec::new();
        for v in variants {
            let q = QueryKeys::new(v);
            match out.iter_mut().find(|o| {
                o.text == q.text
                    && o.artist == q.artist
                    && o.title == q.title
                    && o.fallback == q.fallback
                    && o.alias_kind == q.alias_kind
            }) {
                Some(o) => {
                    o.kept |= q.kept;
                    o.lemmatized &= q.lemmatized;
                }
                None => out.push(q),
            }
        }
        out
    }
}

pub fn best_sim(keys: &Keys, queries: &[QueryKeys]) -> f32 {
    best_match(keys, queries).0
}

pub fn best_match(keys: &Keys, queries: &[QueryKeys]) -> (f32, usize, bool, bool) {
    let mut best = (0.0f32, 0usize, false, false);
    for q in queries {
        let sim = keys.sim(q);
        if sim > best.0 {
            best = (
                sim,
                q.text.chars().count(),
                q.fallback,
                q.alias_kind.is_some(),
            );
        }
    }
    best
}
