use std::time::Instant;

use crate::event::{Event, State, TurnEvent};
use crate::machine::{Core, Phase};
use crate::plan::voiced;
use crate::sentences::Splitter;
use crate::voices;

const STREAMED_OPENING: usize = 20;

pub enum Chat {
    Open { speak: bool },
    Text(String),
    Close,
    Cut,
    Cancel,
}

pub struct Turn {
    pub id: String,
    splitter: Option<Splitter>,
}

impl Core {
    pub fn chat(&mut self, id: String, step: Chat) {
        if let Chat::Open { speak } = step {
            return self.open_turn(id, speak);
        }
        if self.turn.as_ref().is_none_or(|turn| turn.id != id) {
            return;
        }
        match step {
            Chat::Open { .. } => {}
            Chat::Text(text) => self.turn_text(&text),
            Chat::Close => self.end_segment(true),
            Chat::Cut => self.end_segment(false),
            Chat::Cancel => self.cancel_turn(),
        }
    }

    fn open_turn(&mut self, id: String, speak: bool) {
        let step = self
            .plan
            .as_ref()
            .filter(|plan| plan.waiting.as_deref() == Some(id.as_str()));
        let Some(source) = step.map(|plan| plan.origin.source) else {
            return self.emit(Event::Cancelled(TurnEvent { id }));
        };
        let speak = speak && self.config.speak.replies && voiced(source);
        let least = self.opening();
        self.turn = Some(Turn {
            id,
            splitter: speak.then(|| Splitter::new(least)),
        });
        self.watch_turn();
    }

    fn opening(&self) -> usize {
        let voice = voices::find(&self.config.speak.voice);
        let streams = self.deps.voice.is_none() && voice.streams();
        if streams { STREAMED_OPENING } else { 0 }
    }

    fn watch_turn(&mut self) {
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.chat);
    }

    fn turn_text(&mut self, text: &str) {
        self.watch_turn();
        let splitter = self.turn.as_mut().and_then(|turn| turn.splitter.as_mut());
        let sentences = splitter.map(|s| s.push(text)).unwrap_or_default();
        self.speak(sentences);
    }

    fn end_segment(&mut self, whole: bool) {
        self.watch_turn();
        let splitter = self.turn.as_mut().and_then(|turn| turn.splitter.as_mut());
        let rest = splitter.map(Splitter::finish).unwrap_or_default();
        if whole {
            self.speak(rest);
        }
    }

    fn speak(&mut self, sentences: Vec<String>) {
        for sentence in sentences {
            if self.say(sentence) {
                continue;
            }
            if let Some(turn) = self.turn.as_mut() {
                turn.splitter = None;
            }
            return;
        }
    }

    fn cancel_turn(&mut self) {
        let spoke = self.audible();
        self.drop_turn();
        self.drop_reply();
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.done);
        if spoke {
            self.emit_state(State::Thinking, None);
        }
    }

    pub fn close_turn(&mut self) {
        if self.turn.is_some() {
            self.end_segment(true);
            self.turn = None;
        }
    }

    pub fn drop_turn(&mut self) {
        if let Some(turn) = self.turn.take() {
            self.emit(Event::Cancelled(TurnEvent { id: turn.id }));
        }
    }

    pub fn overdue(&mut self, now: Instant) {
        if self.turn.is_some() && self.speaking(now) {
            return self.watch_turn();
        }
        self.drop_turn();
        self.plan = self.plan.take().filter(|plan| plan.asking.is_some());
        self.settle();
    }
}
