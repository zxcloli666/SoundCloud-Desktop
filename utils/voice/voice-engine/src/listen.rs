use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::{Duration, Instant};

use voice_audio::{
    CaptureError, EchoMode, ErrorCode, Event as CaptureEvent, ListenMode, Purpose, Request, Session,
};
use voice_speech::{Event as Heard, Listener, Options};

use crate::Timing;
use crate::config::{Echo, Language, ListenMode as Mode};
use crate::cut_short::cut_short;
use crate::event::{Event, PartialEvent, Source, State};
use crate::fell_quiet::Loudness;
use crate::hotwords;
use crate::machine::{Core, Msg, Phase};
use crate::models;

pub const CHUNK: usize = 1600;
const HEARD_OUT: usize = CHUNK * 4;
const THREADS: i32 = 2;
const EXACT_THREADS: i32 = 4;

pub struct Listen {
    pub r#gen: u64,
    pub session: Session,
    pub for_ask: bool,
    pub window: Option<Duration>,
    pub woken: bool,
    pub started: Instant,
    pub speech_seen: bool,
    pub quiet_since: Option<Instant>,
    pub finals: Vec<String>,
    pub buffer: Vec<f32>,
    pub said: Vec<f32>,
    pub loudness: Loudness,
    pub lost: Option<CaptureError>,
}

impl Listen {
    pub fn deadline(&self, timing: &Timing) -> Instant {
        let limit = if self.for_ask {
            self.started + timing.ask
        } else if let Some(window) = self.window.filter(|_| !self.speech_seen) {
            self.started + window
        } else if self.speech_seen {
            self.started + timing.max_utterance
        } else {
            self.started + timing.max_utterance.min(timing.no_speech)
        };
        match self.quiet_since {
            Some(quiet) => limit.min(quiet + self.pause(timing)),
            None => limit,
        }
    }

    pub fn pause(&self, timing: &Timing) -> Duration {
        let last = self.finals.last().map(String::as_str).unwrap_or_default();
        if voice_nlu::sounds_unfinished(last) {
            timing.unfinished_pause
        } else {
            timing.pause
        }
    }
}

pub fn capture_code(error: &CaptureError) -> &'static str {
    match error.code {
        ErrorCode::MicDenied => "mic_denied",
        ErrorCode::MicLost => "mic_lost",
        ErrorCode::MicBusy | ErrorCode::Other => "mic_busy",
    }
}

pub fn forward(events: Receiver<CaptureEvent>, inbox: Sender<Msg>, r#gen: u64, meter: bool) {
    let _ = std::thread::Builder::new()
        .name("voice-forward".into())
        .spawn(move || {
            for event in events {
                let msg = if meter {
                    Msg::Meter(r#gen, event)
                } else {
                    Msg::Capture(r#gen, event)
                };
                if inbox.send(msg).is_err() {
                    return;
                }
            }
            if !meter {
                let _ = inbox.send(Msg::Closed(r#gen));
            }
        });
}

pub fn take_events(session: &mut Session) -> Receiver<CaptureEvent> {
    std::mem::replace(&mut session.events, channel().1)
}

impl Core {
    pub fn listen(&mut self, for_ask: bool) {
        self.listen_with(for_ask, None);
    }

    fn listen_with(&mut self, for_ask: bool, window: Option<Duration>) {
        let refuse = |core: &mut Self, code, detail| match window {
            Some(_) => {
                core.talking = false;
                core.go_idle();
            }
            None => core.refuse(code, detail, for_ask),
        };
        if !self.star {
            return refuse(self, "not_star", None);
        }
        if self.listener_models().is_none() {
            return refuse(self, "no_models", None);
        }
        self.unwatch();
        let request = self.request(Purpose::Utterance);
        let mut session = match self.deps.capture.start(&request, &self.deps.devices) {
            Ok(session) => session,
            Err(error) => return refuse(self, capture_code(&error), Some(error.detail)),
        };
        if let Err(code) = self.ensure_listener() {
            return refuse(self, code, None);
        }
        let r#gen = self.next_gen();
        forward(take_events(&mut session), self.inbox.clone(), r#gen, false);
        let input = session.inputs.first().map(|d| d.id.clone());
        self.last_input = input.clone();
        if session.echo_cancel.iter().any(|on| *on) {
            self.deps.output.reference(true);
        }
        self.deps.output.duck(self.config.duck);
        if let Some(listener) = self.listener.as_mut() {
            listener.2.reset();
        }
        self.warm_voice();
        self.release_at = None;
        self.phase = Phase::Listening(Box::new(Listen {
            r#gen,
            session,
            for_ask,
            window,
            woken: false,
            started: Instant::now(),
            speech_seen: false,
            quiet_since: None,
            finals: Vec::new(),
            buffer: Vec::with_capacity(CHUNK * 2),
            said: Vec::new(),
            loudness: Loudness::default(),
            lost: None,
        }));
        let state = if for_ask {
            State::Asking
        } else {
            State::Listening
        };
        self.emit_state(state, input);
    }

    fn refuse(&mut self, code: &'static str, detail: Option<String>, for_ask: bool) {
        self.fail(code, detail);
        if !for_ask {
            self.go_idle();
        }
    }

    pub fn request(&self, purpose: Purpose) -> Request {
        let output = self
            .deps
            .output
            .device()
            .or_else(|| {
                self.deps
                    .devices
                    .outputs
                    .iter()
                    .find(|d| d.default)
                    .map(|d| d.id.clone())
            })
            .and_then(|id| self.deps.devices.output_info(&id, false));
        Request {
            purpose,
            mode: match self.config.listen.mode {
                Mode::Chosen => ListenMode::Chosen,
                Mode::WhereISpeak => ListenMode::WhereISpeak,
                Mode::Everywhere => ListenMode::Everywhere,
            },
            chosen: self.config.listen.devices.clone(),
            echo: match self.config.echo {
                Echo::Auto => EchoMode::Auto,
                Echo::On => EchoMode::On,
                Echo::Off => EchoMode::Off,
            },
            noise_suppression: false,
            output,
        }
    }

    fn listener_models(&self) -> Option<(PathBuf, PathBuf)> {
        let store = &self.deps.store;
        let (asr_id, _) = models::asr(self.config.language);
        Some((
            models::dir(store, models::VAD)?,
            models::dir(store, asr_id)?,
        ))
    }

    pub fn ensure_listener(&mut self) -> Result<(), &'static str> {
        let (asr_id, model) = models::asr(self.config.language);
        let Some((vad, asr)) = self.listener_models() else {
            return Err("no_models");
        };
        let boosts = &self.config.boosts;
        let said: Vec<String> = boosts
            .spoken
            .iter()
            .chain(&boosts.artists)
            .cloned()
            .collect();
        let (names, hotwords_score, exact_hotwords_score) = match self.config.language {
            Language::Ru => (
                hotwords::russian(&said),
                hotwords::RUSSIAN_SCORE,
                hotwords::RUSSIAN_EXACT_SCORE,
            ),
            Language::En => (
                hotwords::english(&said),
                hotwords::ENGLISH_SCORE,
                hotwords::ENGLISH_SCORE,
            ),
        };
        let mut hotwords = if self.config.activation.wake.on {
            self.ear().hints()
        } else {
            Vec::new()
        };
        hotwords.extend(names);
        let cached = self
            .listener
            .as_ref()
            .is_some_and(|(id, words, _)| id == asr_id && *words == hotwords);
        if cached {
            return Ok(());
        }
        self.listener = None;
        let mut options = Options {
            vad_model: vad.join("silero_vad.onnx"),
            asr_dir: asr,
            model,
            threads: THREADS,
            hotwords: hotwords.clone(),
            hotwords_score,
            exact_dir: models::exact(self.config.language)
                .and_then(|id| models::dir(&self.deps.store, id)),
            exact_hotwords_score,
            exact_threads: EXACT_THREADS,
        };
        let listener = Listener::open(&options).or_else(|_| {
            options.hotwords.clear();
            Listener::open(&options)
        });
        match listener {
            Ok(listener) => {
                self.listener = Some((asr_id.to_string(), hotwords, listener));
                Ok(())
            }
            Err(_) => Err("asr_failed"),
        }
    }

    pub fn capture(&mut self, r#gen: u64, event: CaptureEvent) {
        if self.watching(r#gen) {
            return self.watched(event);
        }
        let Phase::Listening(listen) = &mut self.phase else {
            return;
        };
        if listen.r#gen != r#gen {
            return;
        }
        match event {
            CaptureEvent::Level { input, rms } => self.level(input, rms),
            CaptureEvent::Selected { input } => self.last_input = Some(input),
            CaptureEvent::Error(error) => listen.lost = Some(error),
            CaptureEvent::Frame { samples, .. } => {
                listen.buffer.extend_from_slice(&samples);
                if listen.buffer.len() >= CHUNK {
                    self.hear();
                }
            }
        }
    }

    fn hear(&mut self) {
        let Phase::Listening(listen) = &mut self.phase else {
            return;
        };
        let Some((_, _, listener)) = self.listener.as_mut() else {
            return;
        };
        let heard = listener.push(&listen.buffer);
        let fell_quiet = listen.loudness.push(&listen.buffer);
        listen.said.extend_from_slice(&listen.buffer);
        listen.buffer.clear();
        if listener.in_speech() {
            listen.speech_seen = true;
            listen.quiet_since = None;
        }
        let hold = self.config.activation.hold && self.source == crate::Source::Hotkey;
        let ends_itself = listen.for_ask || listen.window.is_some() || !hold;
        let mut done = false;
        let mut partials = Vec::new();
        for event in heard {
            match event {
                Heard::Partial(text) => {
                    listen.speech_seen = true;
                    partials.push(text);
                }
                Heard::Final(text) => {
                    listen.speech_seen = true;
                    listen.finals.push(text);
                    done = ends_itself;
                }
            }
        }
        let fell_quiet = fell_quiet
            .filter(|_| ends_itself && listen.speech_seen && listen.quiet_since.is_none());
        for text in partials {
            self.emit(Event::Partial(PartialEvent { text }));
        }
        if done {
            self.phrase_ended();
        } else if let Some(end) = fell_quiet {
            self.finish_at(end);
        }
    }

    pub fn phrase_ended(&mut self) {
        let Phase::Listening(listen) = &mut self.phase else {
            return;
        };
        if listen.pause(&self.deps.timing).is_zero() {
            self.finish_listen();
        } else {
            listen.quiet_since = Some(Instant::now());
        }
    }

    fn finish_at(&mut self, end: usize) {
        let Phase::Listening(listen) = &mut self.phase else {
            return;
        };
        let Some((_, _, listener)) = self.listener.as_mut() else {
            return;
        };
        listener.reset();
        listen.buffer.clear();
        listen.finals.clear();
        let end = (end + HEARD_OUT).min(listen.said.len());
        for chunk in listen.said[..end].chunks(CHUNK) {
            for event in listener.push(chunk) {
                if let Heard::Final(text) = event {
                    listen.finals.push(text);
                }
            }
        }
        listen.said.truncate(end);
        self.finish_listen();
    }

    pub fn close(&mut self, listen: Listen) {
        drop(listen.session);
        if let Some(listener) = self.listener.as_mut() {
            listener.2.reset();
        }
        self.deps.output.reference(false);
    }

    pub fn finish_listen(&mut self) {
        let phase = std::mem::replace(&mut self.phase, Phase::Thinking(Instant::now()));
        let Phase::Listening(listen) = phase else {
            self.phase = phase;
            return;
        };
        let mut listen = *listen;
        self.release_at = None;
        let mut finals = std::mem::take(&mut listen.finals);
        let mut exact = None;
        if let Some((_, _, listener)) = self.listener.as_mut() {
            if !listen.buffer.is_empty() {
                for event in listener.push(&listen.buffer) {
                    if let Heard::Final(text) = event {
                        finals.push(text);
                    }
                }
                listen.said.extend_from_slice(&listen.buffer);
            }
            if let Some(Heard::Final(text)) = listener.finish() {
                finals.push(text);
            }
            if listen.speech_seen {
                exact = listener.exact(&listen.said);
            }
        }
        let for_ask = listen.for_ask;
        let woken = listen.woken;
        self.close(listen);
        let heard = finals.join(" ");
        let heard = heard.trim();
        let exact = exact.filter(|exact| !cut_short(exact, heard));
        let text = if woken {
            exact
                .as_deref()
                .and_then(|exact| self.addressed(exact, true))
                .or_else(|| self.addressed(heard, true))
        } else {
            exact.or_else(|| Some(heard.to_string()).filter(|text| !text.is_empty()))
        };
        let Some(text) = text else {
            self.go_idle();
            return;
        };
        if text.is_empty() {
            return self.listen(false);
        }
        if for_ask {
            self.spoken_answer(text);
        } else {
            self.think(text);
        }
    }

    pub fn listen_timeout(&mut self) {
        let (heard, followed) = match &self.phase {
            Phase::Listening(listen) => (listen.speech_seen, listen.window.is_some()),
            _ => (false, false),
        };
        if heard {
            return self.finish_listen();
        }
        if followed {
            self.talking = false;
        }
        self.go_idle();
    }

    pub fn wind_down(&mut self) {
        match self.follow.take() {
            Some(window) => self.follow_up(window),
            None => self.go_idle(),
        }
    }

    fn follow_up(&mut self, window: Duration) {
        self.listen_with(false, Some(window));
    }

    pub fn reopen(&mut self, source: Source) -> bool {
        let Phase::Listening(listen) = &mut self.phase else {
            return false;
        };
        if listen.window.is_none() || listen.speech_seen {
            return false;
        }
        listen.window = None;
        listen.started = Instant::now();
        self.source = source;
        self.emit_state(State::Listening, self.last_input.clone());
        true
    }

    pub fn closed(&mut self, r#gen: u64) {
        if self.watching(r#gen) {
            return self.watch_lost();
        }
        let lost = match &mut self.phase {
            Phase::Listening(listen) if listen.r#gen == r#gen => listen.lost.take(),
            _ => return,
        };
        let detail = lost.as_ref().map(|e| e.detail.clone());
        let code = lost.as_ref().map(capture_code).unwrap_or("mic_lost");
        self.fail(code, detail);
        self.finish_listen();
    }

    pub fn set_meter(&mut self, on: bool) {
        self.meter = None;
        if !on {
            return;
        }
        let request = self.request(Purpose::Meter);
        match self.deps.capture.start(&request, &self.deps.devices) {
            Ok(mut session) => {
                let r#gen = self.next_gen();
                forward(take_events(&mut session), self.inbox.clone(), r#gen, true);
                self.meter = Some((r#gen, session));
            }
            Err(error) => self.fail(capture_code(&error), Some(error.detail)),
        }
    }

    pub fn meter_event(&mut self, r#gen: u64, event: CaptureEvent) {
        if self.meter.as_ref().map(|(g, _)| *g) != Some(r#gen) {
            return;
        }
        match event {
            CaptureEvent::Level { input, rms } => self.level(input, rms),
            CaptureEvent::Error(error) => self.fail(capture_code(&error), Some(error.detail)),
            _ => {}
        }
    }
}
