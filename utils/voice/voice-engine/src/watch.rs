use std::time::Instant;

use voice_audio::{Event as CaptureEvent, Purpose, Session};
use voice_nlu::Names;
use voice_resolve::Phrase;
use voice_speech::{Event as Heard, SAMPLE_RATE};

use crate::config::Config;
use crate::event::{Event, Source, State, WakeEvent};
use crate::fell_quiet::Loudness;
use crate::listen::{CHUNK, Listen, capture_code, forward, take_events};
use crate::machine::{Core, Phase};
use crate::voices;
use crate::wake::{Call, Ear};

const LEAD: usize = SAMPLE_RATE as usize / 2;
const LONGEST: usize = SAMPLE_RATE as usize * 20;

pub struct Watch {
    pub r#gen: u64,
    session: Session,
    buffer: Vec<f32>,
    said: Vec<f32>,
}

pub fn alike(old: &Config, new: &Config) -> bool {
    old.enabled == new.enabled
        && old.language == new.language
        && old.activation.wake == new.activation.wake
        && old.listen == new.listen
        && old.echo == new.echo
        && old.speak.voice == new.speak.voice
}

impl Core {
    pub fn ear(&self) -> Ear {
        let voice = voices::find(&self.config.speak.voice).id;
        let sensitivity = self.config.activation.wake.sensitivity;
        Ear::new(self.config.language, voice, sensitivity)
    }

    pub fn keep_watch(&mut self) {
        let wanted = self.config.enabled && self.star && self.config.activation.wake.on;
        let free = self.watch.is_none() && matches!(self.phase, Phase::Idle);
        if !wanted || !free || self.watch_refused || self.ensure_listener().is_err() {
            return;
        }
        let request = self.request(Purpose::Wake);
        let mut session = match self.deps.capture.start(&request, &self.deps.devices) {
            Ok(session) => session,
            Err(error) => {
                self.watch_refused = true;
                let code = capture_code(&error);
                if self.watch_told.replace(code) != Some(code) {
                    self.fail(code, Some(error.detail));
                }
                return;
            }
        };
        self.watch_told = None;
        let r#gen = self.next_gen();
        forward(take_events(&mut session), self.inbox.clone(), r#gen, false);
        if session.echo_cancel.iter().any(|on| *on) {
            self.deps.output.reference(true);
        }
        if let Some(listener) = self.listener.as_mut() {
            listener.2.reset();
        }
        self.watch = Some(Watch {
            r#gen,
            session,
            buffer: Vec::with_capacity(CHUNK * 2),
            said: Vec::new(),
        });
    }

    pub fn unwatch(&mut self) {
        if self.watch.take().is_none() {
            return;
        }
        self.deps.output.reference(false);
        if let Some(listener) = self.listener.as_mut() {
            listener.2.reset();
        }
    }

    pub fn rewatch(&mut self) {
        self.watch_refused = false;
        self.unwatch();
        self.keep_watch();
    }

    pub fn watching(&self, r#gen: u64) -> bool {
        self.watch
            .as_ref()
            .is_some_and(|watch| watch.r#gen == r#gen)
    }

    pub fn watch_lost(&mut self) {
        self.watch_refused = true;
        self.unwatch();
    }

    pub fn watched(&mut self, event: CaptureEvent) {
        let Some(watch) = self.watch.as_mut() else {
            return;
        };
        if let CaptureEvent::Frame { samples, .. } = event {
            watch.buffer.extend_from_slice(&samples);
            if watch.buffer.len() >= CHUNK {
                self.overhear();
            }
        }
    }

    fn overhear(&mut self) {
        let Some(watch) = self.watch.as_mut() else {
            return;
        };
        let Some((_, _, listener)) = self.listener.as_mut() else {
            return;
        };
        let heard = listener.push(&watch.buffer);
        watch.said.extend_from_slice(&watch.buffer);
        watch.buffer.clear();
        let ended = heard.iter().any(|event| matches!(event, Heard::Final(_)));
        let most = match (ended, listener.in_speech()) {
            (true, _) => 0,
            (false, true) => LONGEST,
            (false, false) => LEAD,
        };
        if let Some((phrase, finals)) = self.called(heard) {
            return self.wake_up(phrase, finals);
        }
        let Some(watch) = self.watch.as_mut() else {
            return;
        };
        let extra = watch.said.len().saturating_sub(most);
        watch.said.drain(..extra);
    }

    fn called(&self, heard: Vec<Heard>) -> Option<(String, Vec<String>)> {
        let ear = self.ear();
        let mut woken = None;
        for event in heard {
            woken = match event {
                Heard::Partial(text) => match ear.call(&text) {
                    Some(Call::Sure(rest)) if !rest.is_empty() => Some((text, Vec::new())),
                    _ => woken,
                },
                Heard::Final(text) => self
                    .addressed(&text, false)
                    .map(|_| (text.clone(), vec![text])),
            };
        }
        woken
    }

    pub fn addressed(&self, text: &str, keen: bool) -> Option<String> {
        let ear = self.ear();
        let call = if keen {
            ear.recall(text)
        } else {
            ear.call(text)
        };
        match call? {
            Call::Sure(rest) => Some(rest.to_string()),
            Call::Weak(rest) => (rest.is_empty() || self.commands(rest)).then(|| rest.to_string()),
        }
    }

    fn commands(&self, text: &str) -> bool {
        Phrase::read(text, &Names::new(&self.config.names)).commands()
    }

    fn wake_up(&mut self, phrase: String, finals: Vec<String>) {
        let Some(watch) = self.watch.take() else {
            return;
        };
        let complete = !finals.is_empty();
        self.source = Source::Wake;
        self.emit(Event::Wake(WakeEvent { phrase }));
        let input = watch.session.inputs.first().map(|d| d.id.clone());
        self.last_input = input.clone();
        self.deps.output.duck(self.config.duck);
        self.warm_voice();
        self.release_at = None;
        self.phase = Phase::Listening(Box::new(Listen {
            r#gen: watch.r#gen,
            session: watch.session,
            for_ask: false,
            woken: true,
            started: Instant::now(),
            speech_seen: true,
            finals,
            buffer: Vec::with_capacity(CHUNK * 2),
            said: watch.said,
            loudness: Loudness::default(),
            lost: None,
        }));
        self.emit_state(State::Listening, input);
        if complete {
            self.finish_listen();
        }
    }
}
