use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, FixtureCatalog};

pub trait Catalog: Send + Sync {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String>;
}

impl Catalog for FixtureCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String> {
        Ok(voice_resolve::Catalog::candidates(self, variants, kinds))
    }
}
