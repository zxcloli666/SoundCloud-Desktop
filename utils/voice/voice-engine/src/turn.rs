use std::time::Instant;

use crate::event::{Event, State, TurnEvent};
use crate::machine::{Core, Phase};
use crate::plan::{Plan, voiced};
use crate::sentences::{LONGEST, LONGEST_SERVED, Splitter};
use crate::{models, voices};

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
    late: Option<Instant>,
}

impl Core {
    pub fn chat(&mut self, id: String, step: Chat) {
        let Some(step) = self.hold(&id, step) else {
            return;
        };
        let open = self.turn.as_ref().is_some_and(|turn| turn.id == id);
        match step {
            Chat::Open { speak } => self.open_turn(id, speak),
            Chat::Cancel => self.cancel_chat(&id, open),
            Chat::Text(text) if open => self.turn_text(&text),
            Chat::Close if open => self.end_segment(true),
            Chat::Cut if open => self.end_segment(false),
            Chat::Text(_) | Chat::Close | Chat::Cut => {}
        }
    }

    fn open_turn(&mut self, id: String, speak: bool) {
        let step = self
            .plan
            .as_ref()
            .filter(|plan| plan.waiting.as_deref() == Some(id.as_str()) && !plan.hushed);
        let Some(source) = step.map(|plan| plan.origin.source) else {
            return self.emit(Event::Cancelled(TurnEvent { id }));
        };
        let speak = speak && self.config.speak.replies && voiced(source);
        let least = self.opening();
        let longest = self.longest();
        self.turn = Some(Turn {
            id,
            splitter: speak.then(|| Splitter::new(least).within(longest)),
            late: None,
        });
        self.watch_turn();
    }

    fn opening(&self) -> usize {
        let voice = voices::find(&self.config.speak.voice);
        let streams = self.deps.voice.is_none() && voice.streams();
        if streams { STREAMED_OPENING } else { 0 }
    }

    fn longest(&self) -> usize {
        let voice = voices::find(&self.config.speak.voice);
        let served = self.deps.voice.is_none()
            && self.deps.server.is_some()
            && models::on_server(&self.config, voice);
        if served { LONGEST_SERVED } else { LONGEST }
    }

    fn watch_turn(&mut self) {
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.chat);
    }

    fn turn_text(&mut self, text: &str) {
        self.watch_turn();
        let late = Instant::now() + self.deps.timing.opening;
        let Some(turn) = self.turn.as_mut() else {
            return;
        };
        let Some(splitter) = turn.splitter.as_mut() else {
            return;
        };
        let sentences = splitter.push(text);
        turn.late = turn.late.or(Some(late)).filter(|_| splitter.patient());
        self.speak(sentences);
    }

    pub fn turn_deadline(&self) -> Option<Instant> {
        self.turn.as_ref().and_then(|turn| turn.late)
    }

    pub fn turn_tick(&mut self, now: Instant) {
        let late = |turn: &&mut Turn| turn.late.is_some_and(|at| now >= at);
        let Some(turn) = self.turn.as_mut().filter(late) else {
            return;
        };
        turn.late = None;
        let splitter = turn.splitter.as_mut();
        let sentences = splitter.map(Splitter::hurry).unwrap_or_default();
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
        let Some(id) = self.turn.as_ref().map(|turn| turn.id.clone()) else {
            return;
        };
        for sentence in sentences {
            if self.say_in(&id, sentence) {
                continue;
            }
            if let Some(turn) = self.turn.as_mut() {
                turn.splitter = None;
            }
            return;
        }
    }

    fn cancel_chat(&mut self, id: &str, open: bool) {
        let waiting = |plan: &&mut Plan| plan.waiting.as_deref() == Some(id);
        if let Some(plan) = self.plan.as_mut().filter(waiting) {
            plan.hushed = true;
        }
        if open {
            self.cancel_turn();
        } else {
            self.hush_turn(id);
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
        if self.reading.is_some() {
            self.phase = Phase::Thinking(now + self.deps.timing.done);
            return;
        }
        if self.turn.is_some() && self.speaking(now) {
            return self.watch_turn();
        }
        self.drop_turn();
        self.plan = self.plan.take().filter(|plan| plan.asking.is_some());
        self.settle();
    }
}
