use crate::entity::{Decision, Entity, Scored};
use crate::keys::{Keys, QueryKeys, best_match, near};
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
const CLOSER_LEAD: f32 = 0.04;
const FALLBACK_YIELD: f32 = 0.76;
const POPULARITY_GAP: u64 = 50;
const HEARD_MIN: f32 = 0.99;
const NAMED_MIN: f32 = 0.9;
const ADDED_MIN: f32 = 0.6;

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
    let named_is_missing = names_a_missing_artist(&queries, &cands);
    let mut out: Vec<Scored> = cands
        .into_iter()
        .map(|entity| {
            let (sim, qlen, fallback, alias) = best_match(&Keys::new(&entity), &queries);
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
                alias,
            }
        })
        .collect();
    out.sort_by(|a, b| b.score.total_cmp(&a.score));
    let whole: Vec<Scored> = out
        .iter()
        .filter(|s| !s.fallback && s.sim >= FALLBACK_YIELD)
        .cloned()
        .collect();
    out.retain(|part| !part.fallback || !whole.iter().any(|hit| outdoes(hit, part, &queries)));
    if named_is_missing {
        out.retain(|s| s.sim >= HEARD_MIN);
    }
    if let Some(top) = out.first().filter(|s| s.alias || s.sim < HEARD_MIN) {
        let floor = top.entity.popularity / POPULARITY_GAP;
        let asked = |s: &Scored| parsed.kind_hint.is_none_or(|kind| s.entity.kind == kind);
        let named = |s: &Scored| !s.alias && !s.fallback && s.sim >= HEARD_MIN;
        let heard = out
            .iter()
            .position(|s| named(s) && asked(s) && s.entity.popularity >= floor);
        if let Some(i) = heard {
            let exact = out.remove(i);
            out.insert(0, exact);
        }
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

fn outdoes(whole: &Scored, part: &Scored, queries: &[QueryKeys]) -> bool {
    whole.sim >= part.sim || says_what_is_added(queries, &whole.entity, &part.entity)
}

fn says_what_is_added(queries: &[QueryKeys], longer: &Entity, named: &Entity) -> bool {
    let (long, short) = (fold(&longer.name), fold(&named.name));
    let Some(added) = long.strip_prefix(short.as_str()).filter(|a| !a.is_empty()) else {
        return true;
    };
    let parts = || queries.iter().filter(|q| q.fallback);
    let says = |rest: &str| near(rest, added) >= ADDED_MIN;
    let said = |q: &QueryKeys| parts().any(|part| beside(&q.text, &part.text).is_some_and(says));
    queries.iter().filter(|q| !q.fallback).any(said)
}

fn beside<'a>(whole: &'a str, part: &str) -> Option<&'a str> {
    let rest = whole
        .strip_prefix(part)
        .or_else(|| whole.strip_suffix(part));
    rest.filter(|rest| !rest.is_empty())
}

fn names_a_missing_artist(queries: &[QueryKeys], cands: &[Entity]) -> bool {
    let named: Vec<&QueryKeys> = queries.iter().filter(|q| q.names_an_artist()).collect();
    !named.is_empty()
        && !cands.iter().any(|entity| {
            let keys = Keys::new(entity);
            named.iter().any(|q| keys.sim(q) >= NAMED_MIN)
        })
}

pub fn fitting(ranked: Vec<Scored>) -> Vec<Scored> {
    let fits = |scored: &Scored| {
        let (act, ask) = limits(scored.qlen, false);
        let sim = scored.sim.min(1.0);
        sim >= ask && (!scored.fallback || sim >= act)
    };
    ranked.into_iter().filter(fits).collect()
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
        return asked(top, second);
    }
    if let Some(second) = second {
        let clear_lead = top.sim >= 0.95 && second.sim <= top.sim - EXACT_LEAD;
        let dominant = clear_lead
            || top.entity.popularity > second.entity.popularity.saturating_mul(POPULARITY_GAP)
                && (top.sim - second.sim).abs() < 0.03;
        if !dominant && second.sim.min(1.0) >= act && second.score >= top.score * ASK_RATIO {
            return asked(top, Some(second));
        }
    }
    Decision::Act { pick: top.clone() }
}

fn asked(top: &Scored, second: Option<&Scored>) -> Decision {
    let (first, second) = match second {
        Some(closer) if !top.alias && closer.sim >= top.sim + CLOSER_LEAD => (closer, Some(top)),
        _ => (top, second),
    };
    Decision::Ask {
        first: first.clone(),
        second: second.cloned(),
    }
}
