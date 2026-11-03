use serde::Serialize;
use voice_nlu::Kind;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Entity {
    pub kind: Kind,
    pub name: String,
    pub artist: Option<String>,
    pub popularity: u64,
    pub id: String,
    pub aliases: Vec<String>,
}

impl Entity {
    pub fn label(&self) -> String {
        match &self.artist {
            Some(a) => format!("{a} - {}", self.name),
            None => self.name.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Scored {
    pub entity: Entity,
    pub sim: f32,
    pub qlen: usize,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "decision", rename_all = "snake_case")]
pub enum Decision {
    Act { pick: Scored },
    Ask { first: Scored, second: Option<Scored> },
    NotFound,
}
