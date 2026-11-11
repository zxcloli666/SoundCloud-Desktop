use voice_nlu::Kind;

use crate::entity::{Decision, Entity, Scored};
use crate::score;

const POPULAR: u64 = 20_000;
const HANDED: usize = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Bare {
    Popular,
    SureArtist,
}

impl Bare {
    pub(crate) fn plays(self, decision: &Decision) -> bool {
        let top = match decision {
            Decision::Act { pick } => &pick.entity,
            Decision::Ask { first, .. } => &first.entity,
            Decision::NotFound => return false,
        };
        top.popularity >= POPULAR && self.trusts(decision)
    }

    pub(crate) fn trusts(self, decision: &Decision) -> bool {
        match self {
            Bare::Popular => true,
            Bare::SureArtist => {
                matches!(decision, Decision::Act { pick } if pick.entity.kind == Kind::Artist)
            }
        }
    }

    pub(crate) fn hands(self, ranked: Vec<Scored>) -> Vec<Entity> {
        match self {
            Bare::Popular => Vec::new(),
            Bare::SureArtist => {
                let hits = score::fitting(ranked).into_iter().take(HANDED);
                hits.map(|hit| hit.entity).collect()
            }
        }
    }
}
