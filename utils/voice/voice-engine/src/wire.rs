use voice_nlu::Intent;
use voice_resolve::{Decision, Entity, Outcome, Scored};

use crate::event::{CommandEvent, DecisionEvent, EntityEvent, ScoredEvent, Source};

pub struct Origin {
    pub source: Source,
    pub chatless: bool,
}

impl Origin {
    pub fn chats(&self) -> bool {
        !self.chatless
    }
}

pub fn command(outcome: &Outcome, id: String, origin: &Origin) -> CommandEvent {
    let parsed = &outcome.parsed;
    CommandEvent {
        id,
        source: origin.source,
        heard: parsed.heard.clone(),
        normalized: parsed.normalized.clone(),
        intent: intent(outcome).name(),
        kind_hint: parsed.kind_hint.map(|k| k.name()),
        number: parsed.number,
        decision: outcome.decision.as_ref().map(decision),
        chatless: origin.chatless,
        candidates: outcome.candidates.iter().map(EntityEvent::from).collect(),
        group: None,
        step: None,
        steps: None,
    }
}

pub fn talks(outcome: &Outcome) -> bool {
    let asks = matches!(outcome.decision, Some(Decision::Ask { .. }));
    intent(outcome) == Intent::None && !asks
}

fn intent(outcome: &Outcome) -> Intent {
    let not_found = outcome.intent == Intent::None
        && outcome.parsed.intent == Intent::Play
        && matches!(outcome.decision, Some(Decision::NotFound));
    if not_found {
        Intent::Play
    } else {
        outcome.intent
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
