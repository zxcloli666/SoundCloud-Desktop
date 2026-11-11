use std::fmt;
use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Hotkey,
    Headset,
    Wake,
    Button,
    Hud,
    Typed,
    Remote,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Idle,
    Listening,
    Thinking,
    Asking,
    Speaking,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct StateEvent {
    pub state: State,
    pub source: Source,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LevelEvent {
    pub input: String,
    pub rms: f32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PartialEvent {
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct EntityEvent {
    pub kind: &'static str,
    pub name: String,
    pub artist: String,
    pub popularity: u64,
    pub id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ScoredEvent {
    pub entity: EntityEvent,
    pub score: f32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "decision", rename_all = "snake_case")]
pub enum DecisionEvent {
    Act {
        pick: ScoredEvent,
    },
    Ask {
        first: ScoredEvent,
        second: Option<ScoredEvent>,
    },
    NotFound,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct CommandEvent {
    pub id: String,
    pub source: Source,
    pub heard: String,
    pub normalized: String,
    pub intent: &'static str,
    pub kind_hint: Option<&'static str>,
    pub number: Option<u32>,
    pub decision: Option<DecisionEvent>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub candidates: Vec<EntityEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<usize>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ErrorEvent {
    pub code: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct TurnEvent {
    pub id: String,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Looked {
    In(Duration),
    Late,
    Unused,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Timed {
    pub read: Duration,
    pub lookups: Vec<Looked>,
    pub total: Duration,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    State(StateEvent),
    Level(LevelEvent),
    Partial(PartialEvent),
    Command(Box<CommandEvent>),
    Error(ErrorEvent),
    Cancelled(TurnEvent),
    Trouble(String),
    Timed(Timed),
}

impl Event {
    pub fn name(&self) -> &'static str {
        match self {
            Event::State(_) => "voice:state",
            Event::Level(_) => "voice:level",
            Event::Partial(_) => "voice:partial",
            Event::Command(_) => "voice:command",
            Event::Error(_) => "voice:error",
            Event::Cancelled(_) => "voice:cancelled",
            Event::Trouble(_) => "voice:trouble",
            Event::Timed(_) => "voice:timed",
        }
    }

    pub fn error(code: &'static str, detail: Option<String>) -> Event {
        Event::Error(ErrorEvent { code, detail })
    }
}

impl fmt::Display for Looked {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Looked::In(took) => write!(f, "{} ms", took.as_millis()),
            Looked::Late => f.write_str("late"),
            Looked::Unused => f.write_str("unused"),
        }
    }
}

impl fmt::Display for Timed {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let lookups: Vec<String> = self.lookups.iter().map(Looked::to_string).collect();
        write!(
            f,
            "phrase: parse {} ms, lookups {} [{}], total {} ms",
            self.read.as_millis(),
            lookups.len(),
            lookups.join(", "),
            self.total.as_millis()
        )
    }
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
#[serde(default)]
pub struct Outcome {
    pub ok: bool,
    pub speech: String,
    pub display: String,
    pub undo: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_timing_line_tells_the_parse_every_lookup_and_the_total() {
        let ms = Duration::from_millis;
        let timed = Timed {
            read: ms(2),
            lookups: vec![Looked::In(ms(640)), Looked::Late, Looked::Unused],
            total: ms(1502),
        };
        assert_eq!(
            timed.to_string(),
            "phrase: parse 2 ms, lookups 3 [640 ms, late, unused], total 1502 ms"
        );
        let plain = Timed {
            read: ms(0),
            lookups: Vec::new(),
            total: ms(0),
        };
        assert_eq!(
            plain.to_string(),
            "phrase: parse 0 ms, lookups 0 [], total 0 ms"
        );
    }
}
