use crate::entity::{Decision, Entity, Scored};
use crate::keys::{Keys, QueryKeys, best_match};
use std::collections::HashSet;
use voice_nlu::{Kind, Parsed, fold};

pub struct Boosts {
    liked: HashSet<String>,
}

impl Boosts {
    pub fn none() -> Boosts {
        Boosts {
            liked: HashSet::new(),
        }
    }

    pub fn liked_artists(names: &[String]) -> Boosts {
        Boosts {
            liked: names.iter().map(|n| fold(n)).collect(),
        }
    }

    fn factor(&self, e: &Entity) -> f32 {
        let key = match e.kind {
            Kind::Artist => Some(fold(&e.name)),
            Kind::Track | Kind::Album => e.artist.as_deref().map(fold),
            Kind::Playlist => None,
        };
        match (key, e.kind) {
            (Some(k), Kind::Artist) if self.liked.contains(&k) => 1.15,
            (Some(k), _) if self.liked.contains(&k) => 1.08,
            _ => 1.0,
        }
    }
}

pub const BARE_MIN: f32 = 0.88;
pub const WEAK_VERB_MIN: f32 = 0.88;
pub const ASK_RATIO: f32 = 0.92;
const EXACT_LEAD: f32 = 0.07;
const FALLBACK_YIELD: f32 = 0.76;
const POPULARITY_GAP: u64 = 50;

fn popularity_factor(pop: u64) -> f32 {
    let norm = ((1.0 + pop as f32).ln() / (1.0f32 + 1e8).ln()).clamp(0.0, 1.0);
    0.4 + 0.6 * norm
}

fn kind_factor(kind: Kind, hint: Option<Kind>) -> f32 {
    match hint {
        Some(h) if h == kind => 1.0,
        Some(_) => 0.5,
        None => match kind {
            Kind::Artist => 1.0,
            Kind::Track => 0.97,
            Kind::Album => 0.93,
            Kind::Playlist => 0.9,
        },
    }
}

pub fn rank(parsed: &Parsed, cands: Vec<Entity>, boosts: &Boosts) -> Vec<Scored> {
    let queries: Vec<QueryKeys> = QueryKeys::list(&parsed.queries);
    let mut out: Vec<Scored> = cands
        .into_iter()
        .map(|entity| {
            let (sim, qlen, fallback) = best_match(&Keys::new(&entity), &queries);
            let score = sim.powi(2)
                * popularity_factor(entity.popularity)
                * kind_factor(entity.kind, parsed.kind_hint)
                * boosts.factor(&entity);
            Scored {
                entity,
                sim,
                score,
                qlen,
                fallback,
            }
        })
        .collect();
    out.sort_by(|a, b| b.score.total_cmp(&a.score));
    if out.iter().any(|s| !s.fallback && s.sim >= FALLBACK_YIELD) {
        out.retain(|s| !s.fallback);
    }
    if let Some(i) = out.iter().position(|s| s.sim >= 0.95) {
        let rival = out
            .iter()
            .enumerate()
            .filter(|(j, _)| *j != i)
            .map(|(_, s)| s.sim)
            .fold(0.0f32, f32::max);
        if i > 0 && rival <= out[i].sim - EXACT_LEAD {
            let exact = out.remove(i);
            out.insert(0, exact);
        }
    }
    out
}

fn limits(qlen: usize, bare: bool) -> (f32, f32) {
    if bare {
        return (BARE_MIN, BARE_MIN);
    }
    match qlen {
        0..=5 => (0.86, 0.82),
        6..=7 => (0.84, 0.8),
        _ => (0.76, 0.72),
    }
}

pub fn decide(ranked: &[Scored], bare: bool) -> Decision {
    let Some(top) = ranked.first() else {
        return Decision::NotFound;
    };
    let (act, ask) = limits(top.qlen, bare);
    let sim = top.sim.min(1.0);
    if sim < ask || (top.fallback && sim < act) {
        return Decision::NotFound;
    }
    let second = ranked
        .iter()
        .skip(1)
        .find(|s| top.fallback || !s.fallback)
        .filter(|s| s.sim.min(1.0) >= ask);
    if sim < act {
        return Decision::Ask {
            first: top.clone(),
            second: second.cloned(),
        };
    }
    if let Some(second) = second {
        let clear_lead = top.sim >= 0.95 && second.sim <= top.sim - EXACT_LEAD;
        let dominant = clear_lead
            || top.entity.popularity > second.entity.popularity.saturating_mul(POPULARITY_GAP)
                && (top.sim - second.sim).abs() < 0.03;
        if !dominant && second.sim.min(1.0) >= act && second.score >= top.score * ASK_RATIO {
            return Decision::Ask {
                first: top.clone(),
                second: Some(second.clone()),
            };
        }
    }
    Decision::Act { pick: top.clone() }
}
