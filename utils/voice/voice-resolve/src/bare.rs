use voice_nlu::{Kind, Parsed};

use crate::WHOLE_NAME_MIN;
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
            Decision::Act { pick } => pick,
            Decision::Ask { first, .. } => first,
            Decision::NotFound => return false,
        };
        let known = top.entity.popularity >= POPULAR || called_by_kind(parsed, top);
        known && self.trusts(parsed, decision)
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

fn called_by_kind(parsed: &Parsed, hit: &Scored) -> bool {
    let kind = hit.entity.kind;
    let kind_before_name = parsed.kind_alt.is_some() && parsed.kind_hint == Some(kind);
    matches!(kind, Kind::Album | Kind::Playlist) && kind_before_name && hit.sim >= WHOLE_NAME_MIN
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
