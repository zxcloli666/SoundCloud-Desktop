use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, FixtureCatalog};

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Candidates {
    pub entities: Vec<Entity>,
    pub partial: bool,
}

impl Candidates {
    pub fn whole(entities: Vec<Entity>) -> Candidates {
        Candidates {
            entities,
            partial: false,
        }
    }
}

pub trait Catalog: Send + Sync {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Candidates, String>;
}

impl Catalog for FixtureCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Candidates, String> {
        let entities = voice_resolve::Catalog::candidates(self, variants, kinds);
        Ok(Candidates::whole(entities))
    }
}
