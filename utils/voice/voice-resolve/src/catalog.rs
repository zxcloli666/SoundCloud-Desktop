use crate::entity::Entity;
use crate::keys::{Keys, QueryKeys, best_sim};
use voice_nlu::{Kind, Variant};

pub trait Catalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity>;
}

pub struct FixtureCatalog {
    rows: Vec<(Entity, Keys)>,
}

impl FixtureCatalog {
    pub fn from_tsv(text: &str, with_aliases: bool) -> FixtureCatalog {
        let mut rows = Vec::new();
        for (n, line) in text.lines().enumerate().skip(1) {
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 4 {
                continue;
            }
            let Some(kind) = Kind::from_name(cols[0].trim()) else {
                continue;
            };
            let aliases = if with_aliases {
                cols.get(4)
                    .map(|a| {
                        a.split('|')
                            .map(str::trim)
                            .filter(|s| !s.is_empty())
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                Vec::new()
            };
            let artist = Some(cols[2].trim())
                .filter(|a| !a.is_empty())
                .map(String::from);
            let entity = Entity {
                kind,
                name: cols[1].trim().to_string(),
                artist,
                popularity: cols[3].trim().parse().unwrap_or(0),
                id: format!("{}:{n}", kind.name()),
                aliases,
            };
            let keys = Keys::new(&entity);
            rows.push((entity, keys));
        }
        FixtureCatalog { rows }
    }

    pub fn len(&self) -> usize {
        self.rows.len()
    }
}

impl Catalog for FixtureCatalog {
    fn candidates(&self, variants: &[Variant], kinds: &[Kind]) -> Vec<Entity> {
        let queries: Vec<QueryKeys> = QueryKeys::list(variants);
        let mut hits: Vec<(f32, &Entity)> = self
            .rows
            .iter()
            .filter(|(e, _)| kinds.contains(&e.kind))
            .map(|(e, k)| (best_sim(k, &queries), e))
            .filter(|(s, _)| *s >= 0.5)
            .collect();
        hits.sort_by(|a, b| b.0.total_cmp(&a.0));
        hits.into_iter().take(40).map(|(_, e)| e.clone()).collect()
    }
}
