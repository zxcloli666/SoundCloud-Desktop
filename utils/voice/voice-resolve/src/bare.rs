use voice_nlu::{Kind, Parsed};

use crate::alias;
use crate::entity::{Decision, Entity, Scored};
use crate::keys::{Keys, QueryKeys};
use crate::score;

const POPULAR: u64 = 20_000;
const HANDED: usize = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bare {
    Popular,
    Certain,
}

impl Bare {
    pub(crate) fn plays(self, parsed: &Parsed, decision: &Decision) -> bool {
        let top = match decision {
            Decision::Act { pick } => &pick.entity,
            Decision::Ask { first, .. } => &first.entity,
            Decision::NotFound => return false,
        };
        top.popularity >= POPULAR && self.trusts(parsed, decision)
    }

    pub(crate) fn trusts(self, parsed: &Parsed, decision: &Decision) -> bool {
        match (self, decision) {
            (Bare::Popular, _) => true,
            (Bare::Certain, Decision::Act { pick }) => certain(parsed, &pick.entity),
            (Bare::Certain, _) => false,
        }
    }

    pub(crate) fn hands(self, ranked: Vec<Scored>) -> Vec<Entity> {
        match self {
            Bare::Popular => Vec::new(),
            Bare::Certain => {
                let hits = score::fitting(ranked).into_iter().take(HANDED);
                hits.map(|hit| hit.entity).collect()
            }
        }
    }
}

fn certain(parsed: &Parsed, hit: &Entity) -> bool {
    match hit.kind {
        Kind::Artist => true,
        Kind::Track => credited(parsed, hit),
        Kind::Album | Kind::Playlist => parsed.kind_hint == Some(hit.kind) || credited(parsed, hit),
    }
}

fn credited(parsed: &Parsed, hit: &Entity) -> bool {
    let keys = Keys::new(hit);
    let said = QueryKeys::list(&alias::expand(&parsed.queries));
    said.iter().any(|query| keys.credited(query))
}
