use voice_nlu::Intent;
use voice_resolve::{Decision, Entity, Outcome, Scored};

use crate::event::{CommandEvent, DecisionEvent, EntityEvent, ScoredEvent, Source};

pub struct Origin {
    pub source: Source,
    pub remote_id: Option<String>,
}

pub fn command(outcome: &Outcome, id: String, origin: &Origin) -> CommandEvent {
    let parsed = &outcome.parsed;
    let not_found = outcome.intent == Intent::None
        && parsed.intent == Intent::Play
        && matches!(outcome.decision, Some(Decision::NotFound));
    let intent = if not_found {
        Intent::Play
    } else {
        outcome.intent
    };
    CommandEvent {
        id,
        source: origin.source,
        heard: parsed.heard.clone(),
        normalized: parsed.normalized.clone(),
        intent: intent.name(),
        kind_hint: parsed.kind_hint.map(|k| k.name()),
        number: parsed.number,
        decision: outcome.decision.as_ref().map(decision),
        candidates: outcome.candidates.iter().map(EntityEvent::from).collect(),
        remote_id: origin.remote_id.clone(),
        group: None,
        step: None,
        steps: None,
    }
}

pub fn decision(decision: &Decision) -> DecisionEvent {
    match decision {
        Decision::Act { pick } => DecisionEvent::Act { pick: scored(pick) },
        Decision::Ask { first, second } => DecisionEvent::Ask {
            first: scored(first),
            second: second.as_ref().map(scored),
        },
        Decision::NotFound => DecisionEvent::NotFound,
    }
}

pub fn scored(scored: &Scored) -> ScoredEvent {
    ScoredEvent {
        entity: EntityEvent::from(&scored.entity),
        score: scored.score,
    }
}

impl From<&Entity> for EntityEvent {
    fn from(entity: &Entity) -> EntityEvent {
        EntityEvent {
            kind: entity.kind.name(),
            name: entity.name.clone(),
            artist: entity.artist.clone().unwrap_or_default(),
            popularity: entity.popularity,
            id: entity.id.clone(),
        }
    }
}
