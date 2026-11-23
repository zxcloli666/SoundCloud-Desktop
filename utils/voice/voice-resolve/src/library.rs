use crate::catalog::Catalog;
use crate::entity::Entity;
use crate::keys::{Keys, QueryKeys, best_sim};
use voice_nlu::{Kind, Variant};

const NEAR: f32 = 0.5;
const KEPT: usize = 12;

#[derive(Default)]
pub struct Library {
    rows: Vec<(Entity, Keys)>,
}

impl Library {
    pub fn new(entities: Vec<Entity>) -> Library {
        let rows = entities
            .into_iter()
            .map(|entity| {
                let keys = Keys::new(&entity);
                (entity, keys)
            })
            .collect();
        Library { rows }
    }

    pub fn len(&self) -> usize {
        self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }
}

impl Catalog for Library {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        nearest(&self.rows, variants, kinds, KEPT)
    }
}

pub(crate) fn nearest(
    rows: &[(Entity, Keys)],
    variants: &[Variant],
    kinds: &[Kind],
    kept: usize,
) -> Vec<Entity> {
    let queries = QueryKeys::list(variants);
    let mut hits: Vec<(f32, &Entity)> = rows
        .iter()
        .filter(|(e, _)| kinds.contains(&e.kind))
        .map(|(e, k)| (best_sim(k, &queries), e))
        .filter(|(sim, _)| *sim >= NEAR)
        .collect();
    hits.sort_by(|a, b| b.0.total_cmp(&a.0));
    hits.into_iter()
        .take(kept)
        .map(|(_, e)| e.clone())
        .collect()
}
