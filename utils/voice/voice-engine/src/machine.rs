use std::sync::Arc;
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use voice_audio::{Event as CaptureEvent, Session};
use voice_speech::Listener;

use crate::config::Config;
use crate::event::{Event, LevelEvent, Source, State, StateEvent};
use crate::listen::Listen;
use crate::memory::Memory;
use crate::plan::Plan;
use crate::read::{Read, Reading};
use crate::speak::Reply;
use crate::speaker::Playing;
use crate::tts::{Piece, Tts};
use crate::turn::Turn;
use crate::{Command, Deps};

const IDLE_WAIT: Duration = Duration::from_secs(3600);

pub enum Msg {
    Command(Command),
    Capture(u64, CaptureEvent),
    Closed(u64),
    Meter(u64, CaptureEvent),
    Synth(u64, Piece),
    Spoken(u64),
    Previewed(u64),
    Read(u64, Read),
}

pub enum Phase {
    Idle,
    Listening(Box<Listen>),
    Thinking(Instant),
    Asking(Instant),
    Speaking,
}

pub struct Core {
    pub deps: Deps,
    pub config: Config,
    pub star: bool,
    pub events: Sender<Event>,
    pub inbox: Sender<Msg>,
    pub phase: Phase,
    pub source: Source,
    pub reading: Option<Reading>,
    pub memory: Arc<Memory>,
    pub plan: Option<Plan>,
    pub listener: Option<(String, Vec<String>, Listener)>,
    pub tts: Tts,
    pub reply: Option<Reply>,
    pub turn: Option<Turn>,
    pub playing: Option<Playing>,
    pub meter: Option<(u64, Session)>,
    pub preview: Option<u64>,
    pub last_input: Option<String>,
    pub last_release: Option<Instant>,
    pub release_at: Option<Instant>,
    counter: u64,
    prefix: u64,
}

impl Core {
    pub fn new(deps: Deps, memory: Arc<Memory>, events: Sender<Event>, inbox: Sender<Msg>) -> Self {
        let reply = inbox.clone();
        let tts = Tts::start(
            Box::new(move |r#gen, piece| {
                let _ = reply.send(Msg::Synth(r#gen, piece));
            }),
            deps.phrases.clone(),
        );
        let prefix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        Self {
            deps,
            config: Config::default(),
            star: false,
            events,
            inbox,
            phase: Phase::Idle,
            source: Source::Button,
            reading: None,
            memory,
            plan: None,
            listener: None,
            tts,
            reply: None,
            turn: None,
            playing: None,
            meter: None,
            preview: None,
            last_input: None,
            last_release: None,
            release_at: None,
            counter: 0,
            prefix,
        }
    }

    pub fn run(mut self, messages: Receiver<Msg>) {
        loop {
            let now = Instant::now();
            let wait = self
                .deadline()
                .map(|at| at.saturating_duration_since(now))
                .unwrap_or(IDLE_WAIT);
            match messages.recv_timeout(wait) {
                Ok(msg) => self.handle(msg),
                Err(RecvTimeoutError::Timeout) => self.tick(Instant::now()),
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }
    }

    pub fn emit(&self, event: Event) {
        let _ = self.events.send(event);
    }

    pub fn emit_state(&self, state: State, input: Option<String>) {
        self.emit(Event::State(StateEvent {
            state,
            source: self.source,
            input,
        }));
    }

    pub fn fail(&self, code: &'static str, detail: Option<String>) {
        self.emit(Event::error(code, detail));
    }

    pub fn next_id(&mut self) -> String {
        self.counter += 1;
        format!("v{:x}-{}", self.prefix, self.counter)
    }

    pub fn next_gen(&mut self) -> u64 {
        self.counter += 1;
        self.counter
    }

    pub fn go_idle(&mut self) {
        let phase = std::mem::replace(&mut self.phase, Phase::Idle);
        if let Phase::Listening(listen) = phase {
            self.close(*listen);
        }
        self.drop_turn();
        self.drop_reading();
        self.drop_reply();
        self.release_at = None;
        self.deps.output.duck(1.0);
        self.emit_state(State::Idle, None);
    }

    fn deadline(&self) -> Option<Instant> {
        let phase = match &self.phase {
            Phase::Idle | Phase::Speaking => None,
            Phase::Listening(listen) => Some(listen.deadline(&self.deps.timing)),
            Phase::Thinking(until) | Phase::Asking(until) => Some(*until),
        };
        let waits = [
            phase,
            self.speech_deadline(),
            self.turn_deadline(),
            self.release_at,
        ];
        waits.into_iter().flatten().min()
    }

    fn tick(&mut self, now: Instant) {
        if self.release_at.is_some_and(|at| now >= at) {
            self.release_at = None;
            if matches!(self.phase, Phase::Listening(_)) {
                self.finish_listen();
                return;
            }
        }
        self.speech_tick(now);
        self.turn_tick(now);
        match &self.phase {
            Phase::Idle | Phase::Speaking => {}
            Phase::Listening(listen) => {
                if now >= listen.deadline(&self.deps.timing) {
                    self.listen_timeout();
                }
            }
            Phase::Thinking(until) | Phase::Asking(until) => {
                if now >= *until {
                    self.overdue(now);
                }
            }
        }
    }

    fn handle(&mut self, msg: Msg) {
        match msg {
            Msg::Command(command) => self.command(command),
            Msg::Capture(r#gen, event) => self.capture(r#gen, event),
            Msg::Closed(r#gen) => self.closed(r#gen),
            Msg::Meter(r#gen, event) => self.meter_event(r#gen, event),
            Msg::Synth(r#gen, piece) => self.synthesized(r#gen, piece),
            Msg::Spoken(r#gen) => self.spoken(r#gen),
            Msg::Read(serial, read) => self.understood(serial, read),
            Msg::Previewed(r#gen) => {
                if self.preview == Some(r#gen) {
                    self.preview = None;
                    self.emit_state(self.state(), None);
                }
            }
        }
    }

    pub fn state(&self) -> State {
        match &self.phase {
            Phase::Idle => State::Idle,
            Phase::Listening(listen) if listen.for_ask => State::Asking,
            Phase::Listening(_) => State::Listening,
            Phase::Asking(_) => State::Asking,
            Phase::Thinking(_) | Phase::Speaking if self.audible() => State::Speaking,
            Phase::Thinking(_) | Phase::Speaking => State::Thinking,
        }
    }

    fn command(&mut self, command: Command) {
        match command {
            Command::Apply(config) => self.apply(*config),
            Command::Star(star) => {
                self.star = star;
                if !star {
                    self.cancel();
                }
            }
            Command::Devices(devices) => self.deps.devices = devices,
            Command::Models => {
                if !matches!(self.phase, Phase::Listening(_)) {
                    self.listener = None;
                }
            }
            Command::Start(source) => self.start(source),
            Command::Press(source) => self.press(source),
            Command::Release(_) => self.release(),
            Command::Stop => {
                if matches!(self.phase, Phase::Listening(_)) {
                    self.finish_listen();
                }
            }
            Command::Cancel => self.cancel(),
            Command::Text { text, source, id } => self.text(text, source, id),
            Command::Answer(choice) => self.answer(&choice),
            Command::Done { id, outcome } => self.done(&id, outcome),
            Command::Chat { id, step } => self.chat(id, step),
            Command::Reread(id) => self.reread(&id),
            Command::Meter(on) => self.set_meter(on),
            Command::Preview(wav) => self.play_preview(&wav),
        }
    }

    fn apply(&mut self, config: Config) {
        let language_changed = config.language != self.config.language;
        let enabled = config.enabled;
        self.config = config;
        if language_changed {
            self.listener = None;
        }
        if !enabled {
            self.listener = None;
            self.set_meter(false);
            if !matches!(self.phase, Phase::Idle) {
                self.cancel();
            }
        }
        if enabled && self.star && matches!(self.phase, Phase::Idle) {
            let _ = self.ensure_listener();
        }
    }

    pub fn cancel(&mut self) {
        self.drop_turn();
        self.hush();
        self.plan = None;
        if let Some(listener) = self.listener.as_mut() {
            listener.2.reset();
        }
        self.go_idle();
    }

    fn start(&mut self, source: Source) {
        match &self.phase {
            Phase::Listening(_) => self.finish_listen(),
            Phase::Asking(_) => {
                self.source = source;
                self.listen(true);
            }
            _ => {
                self.interrupt();
                self.source = source;
                self.listen(false);
            }
        }
    }

    fn press(&mut self, source: Source) {
        let now = Instant::now();
        let repeat = self
            .last_release
            .is_some_and(|at| now.saturating_duration_since(at) <= self.deps.timing.release);
        if repeat {
            self.release_at = None;
            return;
        }
        let hold = self.config.activation.hold;
        match &self.phase {
            Phase::Listening(_) if hold => self.release_at = None,
            Phase::Listening(_) => self.finish_listen(),
            Phase::Asking(_) => {
                self.source = source;
                self.listen(true);
            }
            _ => {
                self.interrupt();
                self.source = source;
                self.listen(false);
            }
        }
    }

    fn release(&mut self) {
        let now = Instant::now();
        self.last_release = Some(now);
        if self.config.activation.hold && matches!(self.phase, Phase::Listening(_)) {
            self.release_at = Some(now + self.deps.timing.release);
        }
    }

    fn interrupt(&mut self) {
        self.drop_turn();
        self.drop_reading();
        if self.audible() || self.preview.is_some() {
            self.hush();
        }
        let asking = self.plan.as_ref().is_some_and(|plan| plan.asking.is_some());
        if !asking {
            self.plan = None;
        }
        self.drop_reply();
    }

    fn text(&mut self, text: String, source: Source, id: Option<String>) {
        if !self.star {
            self.source = source;
            self.fail("not_star", None);
            return;
        }
        if matches!(self.phase, Phase::Listening(_)) {
            let phase = std::mem::replace(&mut self.phase, Phase::Idle);
            if let Phase::Listening(listen) = phase {
                self.close(*listen);
            }
        }
        self.drop_turn();
        self.drop_reading();
        self.drop_reply();
        self.source = source;
        self.think(text.trim().to_string(), id);
    }

    pub fn level(&self, input: String, rms: f32) {
        self.emit(Event::Level(LevelEvent { input, rms }));
    }
}
