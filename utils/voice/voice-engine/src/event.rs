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

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    State(StateEvent),
    Level(LevelEvent),
    Partial(PartialEvent),
    Command(Box<CommandEvent>),
    Error(ErrorEvent),
}

impl Event {
    pub fn name(&self) -> &'static str {
        match self {
            Event::State(_) => "voice:state",
            Event::Level(_) => "voice:level",
            Event::Partial(_) => "voice:partial",
            Event::Command(_) => "voice:command",
            Event::Error(_) => "voice:error",
        }
    }

    pub fn error(code: &'static str, detail: Option<String>) -> Event {
        Event::Error(ErrorEvent { code, detail })
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
