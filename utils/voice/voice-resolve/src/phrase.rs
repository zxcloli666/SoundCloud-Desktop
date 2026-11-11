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
