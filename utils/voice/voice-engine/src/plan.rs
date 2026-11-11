use std::time::Instant;

use voice_nlu::Intent;
use voice_resolve::{Bare, Boosts, Decision, Outcome as Understood, Scored, answer_ask, interpret};

use crate::catalog::Probe;
use crate::event::{Event, Outcome, Source, State};
use crate::machine::{Core, Phase};
use crate::wire::{self, Origin};

pub struct Plan {
    pub group: String,
    pub origin: Origin,
    pub outcomes: Vec<Understood>,
    pub next: usize,
    pub waiting: Option<String>,
    pub hushed: bool,
    pub speech: Vec<String>,
    pub asking: Option<(usize, Scored, Option<Scored>)>,
}

pub fn voiced(source: Source) -> bool {
    !matches!(source, Source::Typed | Source::Remote)
}

impl Core {
    pub fn running(&self) -> bool {
        self.plan.as_ref().is_some_and(|plan| plan.asking.is_none())
    }

    pub fn think(&mut self, text: String, remote_id: Option<String>) {
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.done);
        self.emit_state(State::Thinking, None);
        if let Some(index) = self.match_answer(&text) {
            if let Some(plan) = self.plan.as_mut() {
                plan.origin = Origin {
                    source: self.source,
                    remote_id,
                };
            }
            self.choose(index);
            return;
        }
        self.drop_turn();
        self.plan = None;
        let boosts = Boosts::liked_artists(&self.config.boosts.artists);
        let probe = Probe::new(self.deps.catalog.as_ref());
        let bare = if self.config.llm {
            Bare::Certain
        } else {
            Bare::Popular
        };
        let outcomes = interpret(&text, &probe, &boosts, bare);
        if let Some(error) = probe.failure.take() {
            self.fail("network", Some(error));
            self.go_idle();
            return;
        }
        let group = self.next_id();
        self.plan = Some(Plan {
            group,
            origin: Origin {
                source: self.source,
                remote_id,
            },
            outcomes,
            next: 0,
            waiting: None,
            hushed: false,
            speech: Vec::new(),
            asking: None,
        });
        self.advance();
    }

    pub fn spoken_answer(&mut self, text: String) {
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.done);
        self.emit_state(State::Thinking, None);
        match self.match_answer(&text) {
            Some(index) => self.choose(index),
            None => self.think(text, None),
        }
    }

    pub fn answer(&mut self, choice: &str) {
        let Some((_, _, second)) = self.plan.as_ref().and_then(|p| p.asking.as_ref()) else {
            self.emit_state(self.state(), None);
            return;
        };
        let index = match choice {
            "first" => Some(0),
            "second" if second.is_some() => Some(1),
            _ => None,
        };
        if matches!(self.phase, Phase::Listening(_)) {
            let phase = std::mem::replace(&mut self.phase, Phase::Idle);
            if let Phase::Listening(listen) = phase {
                self.close(*listen);
            }
        }
        match index {
            Some(index) => {
                self.phase = Phase::Thinking(Instant::now() + self.deps.timing.done);
                self.emit_state(State::Thinking, None);
                self.choose(index);
            }
            None => self.think(choice.to_string(), None),
        }
    }

    fn match_answer(&self, text: &str) -> Option<usize> {
        let (_, first, second) = self.plan.as_ref()?.asking.as_ref()?;
        let index = answer_ask(text, first, second.as_ref().unwrap_or(first))?;
        if index == 1 && second.is_none() {
            return None;
        }
        Some(index)
    }

    fn choose(&mut self, index: usize) {
        let Some(plan) = self.plan.as_mut() else {
            return self.go_idle();
        };
        let Some((step, first, second)) = plan.asking.take() else {
            return self.go_idle();
        };
        let pick = if index == 1 {
            second.unwrap_or(first)
        } else {
            first
        };
        let mut outcome = plan.outcomes[step].clone();
        if outcome.intent == Intent::None {
            outcome.intent = outcome.parsed.intent;
        }
        if outcome.intent == Intent::None {
            outcome.intent = Intent::Play;
        }
        outcome.decision = Some(Decision::Act { pick });
        self.send_step(step, &outcome);
    }

    fn send_step(&mut self, step: usize, outcome: &Understood) {
        let id = self.next_id();
        let Some(plan) = self.plan.as_mut() else {
            return;
        };
        let mut command = wire::command(outcome, id.clone(), &plan.origin);
        let steps = plan.outcomes.len();
        if steps > 1 {
            command.group = Some(plan.group.clone());
            command.step = Some(step + 1);
            command.steps = Some(steps);
        }
        plan.waiting = Some(id.clone());
        plan.hushed = false;
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.done);
        self.emit(Event::Command(Box::new(command)));
    }

    fn advance(&mut self) {
        let Some(plan) = self.plan.as_mut() else {
            return self.go_idle();
        };
        if plan.next >= plan.outcomes.len() {
            return self.finish_plan();
        }
        let step = plan.next;
        plan.next += 1;
        let outcome = plan.outcomes[step].clone();
        if let Some(Decision::Ask { first, second }) = &outcome.decision {
            plan.asking = Some((step, first.clone(), second.clone()));
            self.send_step(step, &outcome);
            if let Some(plan) = self.plan.as_mut() {
                plan.waiting = None;
            }
            return self.enter_ask();
        }
        self.send_step(step, &outcome);
    }

    fn enter_ask(&mut self) {
        self.phase = Phase::Asking(Instant::now() + self.deps.timing.ask);
        if voiced(self.source) {
            self.drop_reply();
            self.listen(true);
        }
        if matches!(self.phase, Phase::Asking(_)) {
            self.emit_state(State::Asking, None);
        }
    }

    pub fn done(&mut self, id: &str, outcome: Outcome) {
        let Some(plan) = self.plan.as_mut() else {
            return;
        };
        if plan.waiting.as_deref() != Some(id) {
            return;
        }
        plan.waiting = None;
        let speech = outcome.speech.trim();
        if !speech.is_empty() {
            plan.speech.push(speech.to_string());
        }
        self.close_turn();
        self.advance();
    }

    fn finish_plan(&mut self) {
        let Some(plan) = self.plan.take() else {
            return self.go_idle();
        };
        let text = plan.speech.join(". ");
        if !text.is_empty() && self.config.speak.replies && voiced(plan.origin.source) {
            self.say(text);
        }
        self.settle();
    }
}
