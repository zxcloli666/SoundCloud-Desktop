use std::cell::RefCell;

use voice_nlu::{Kind, Variant};
use voice_resolve::{Entity, FixtureCatalog};

pub trait Catalog: Send {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String>;
}

impl Catalog for FixtureCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Result<Vec<Entity>, String> {
        Ok(voice_resolve::Catalog::candidates(self, variants, kinds))
    }
}

pub struct Probe<'a> {
    catalog: &'a dyn Catalog,
    pub failure: RefCell<Option<String>>,
}

impl<'a> Probe<'a> {
    pub fn new(catalog: &'a dyn Catalog) -> Self {
        Self {
            catalog,
            failure: RefCell::new(None),
        }
    }
}

impl voice_resolve::Catalog for Probe<'_> {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        match self.catalog.candidates(variants, kinds) {
            Ok(found) => found,
            Err(error) => {
                self.failure.replace(Some(error));
                Vec::new()
            }
        }
    }
}
