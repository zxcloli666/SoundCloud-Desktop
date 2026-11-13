use std::cell::RefCell;

use voice_nlu::{Intent, Kind, Names, Parsed, Variant, parse};

use crate::bare::Bare;
use crate::catalog::Catalog;
use crate::entity::Entity;
use crate::score::Boosts;
use crate::{WHOLE_NAME_MIN, interpret_split, ranked};

pub struct Phrase {
    said: Vec<Parsed>,
    whole: Option<Vec<Parsed>>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Lookup {
    pub variants: Vec<Variant>,
    pub kinds: Vec<Kind>,
}

impl Lookup {
    pub fn texts(&self) -> Vec<String> {
        let said = self.variants.iter().filter(|v| !v.fallback);
        let parts = said
            .clone()
            .flat_map(|v| [v.artist.clone(), v.title.clone()]);
        let fallbacks = self.variants.iter().filter(|v| v.fallback);
        let texts = said.map(|v| v.text.clone()).chain(parts.flatten());
        distinct(texts.chain(fallbacks.map(|v| v.text.clone())))
    }

    pub fn known(&self) -> bool {
        let first = self.texts().into_iter().next();
        let curated = self.variants.iter().filter(|v| !v.fallback);
        let mut curated = curated.filter(|v| v.alias_kind.is_some());
        curated.any(|v| first.as_deref() == Some(v.text.trim()))
    }

    pub fn fuller(&self) -> Vec<String> {
        let own = self.variants.iter().filter(|v| v.alias_kind.is_none());
        let said = own.filter(|v| !v.lemmatized && !v.fallback);
        let fuller = said.filter(|v| v.kept_fillers || v.artist.is_some() && v.title.is_some());
        distinct(fuller.map(|v| v.text.clone()))
    }
}

fn distinct(texts: impl Iterator<Item = String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for text in texts.map(|text| text.trim().to_string()) {
        if !text.is_empty() && !out.contains(&text) {
            out.push(text);
        }
    }
    out
}

#[derive(Default)]
struct Asked(RefCell<Vec<Lookup>>);

impl Catalog for Asked {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        let lookup = Lookup {
            variants: variants.to_vec(),
            kinds: kinds.to_vec(),
        };
        let mut asked = self.0.borrow_mut();
        if !asked.contains(&lookup) {
            asked.push(lookup);
        }
        Vec::new()
    }
}

impl Phrase {
    pub fn read(text: &str, names: &Names) -> Phrase {
        let said = parse(text, names);
        let looks_up = |p: &Parsed| !p.queries.is_empty() || !p.alt.is_empty();
        let doubt = names.in_doubt(text) && said.iter().any(looks_up);
        let whole = doubt.then(|| parse(text, &Names::default()));
        Phrase { said, whole }
    }

    pub fn commands(&self) -> bool {
        self.readings().any(|parsed| parsed.intent != Intent::None)
    }

    pub fn lookups(&self) -> Vec<Lookup> {
        let asked = Asked::default();
        let boosts = Boosts::none();
        self.reading(&asked, &boosts);
        for parsed in self.readings() {
            interpret_split(parsed.clone(), &asked, &boosts, Bare::Popular);
        }
        asked.0.into_inner()
    }

    pub(crate) fn reading(&self, catalog: &dyn Catalog, boosts: &Boosts) -> &[Parsed] {
        let sure = |p: &Parsed| {
            let best = || ranked(p, catalog, boosts).into_iter().next();
            !p.queries.is_empty() && best().is_some_and(|hit| hit.sim >= WHOLE_NAME_MIN)
        };
        match &self.whole {
            Some(whole) if whole.iter().any(sure) => whole,
            _ => &self.said,
        }
    }

    fn readings(&self) -> impl Iterator<Item = &Parsed> {
        self.said.iter().chain(self.whole.iter().flatten())
    }
}
