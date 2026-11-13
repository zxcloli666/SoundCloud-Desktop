use std::path::PathBuf;
use std::sync::mpsc::{Receiver, Sender, channel};
use std::time::Instant;

use voice_audio::{
    CaptureError, EchoMode, ErrorCode, Event as CaptureEvent, ListenMode, Purpose, Request, Session,
};
use voice_speech::{Event as Heard, Listener, Options};

use crate::Timing;
use crate::config::{Echo, Language, ListenMode as Mode};
use crate::event::{Event, PartialEvent, State};
use crate::fell_quiet::Loudness;
use crate::hotwords;
use crate::machine::{Core, Msg, Phase};
use crate::models;

const CHUNK: usize = 1600;
const HEARD_OUT: usize = CHUNK * 4;
const HOTWORDS_SCORE: f32 = 1.5;
const THREADS: i32 = 2;

pub struct Listen {
    pub r#gen: u64,
    pub session: Session,
    pub for_ask: bool,
    pub started: Instant,
    pub speech_seen: bool,
    pub finals: Vec<String>,
    pub buffer: Vec<f32>,
    pub said: Vec<f32>,
    pub loudness: Loudness,
    pub lost: Option<CaptureError>,
}

impl Listen {
    pub fn deadline(&self, timing: &Timing) -> Instant {
        if self.for_ask {
            return self.started + timing.ask;
        }
        let max = self.started + timing.max_utterance;
        if self.speech_seen {
            max
        } else {
            max.min(self.started + timing.no_speech)
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

fn forward(events: Receiver<CaptureEvent>, inbox: Sender<Msg>, r#gen: u64, meter: bool) {
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

fn take_events(session: &mut Session) -> Receiver<CaptureEvent> {
    std::mem::replace(&mut session.events, channel().1)
}

impl Core {
    pub fn listen(&mut self, for_ask: bool) {
        if !self.star {
            return self.refuse("not_star", None, for_ask);
        }
        if self.listener_models().is_none() {
            return self.refuse("no_models", None, for_ask);
        }
        let request = self.request(Purpose::Utterance);
        let mut session = match self.deps.capture.start(&request, &self.deps.devices) {
            Ok(session) => session,
            Err(error) => return self.refuse(capture_code(&error), Some(error.detail), for_ask),
        };
        if let Err(code) = self.ensure_listener() {
            return self.refuse(code, None, for_ask);
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
            started: Instant::now(),
            speech_seen: false,
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
        let hotwords = match self.config.language {
            Language::Ru => hotwords::russian(&self.config.boosts.artists),
            Language::En => Vec::new(),
        };
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
            hotwords_score: HOTWORDS_SCORE,
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
        }
        let hold = self.config.activation.hold && self.source == crate::Source::Hotkey;
        let ends_itself = listen.for_ask || !hold;
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
        let fell_quiet = fell_quiet.filter(|_| ends_itself && listen.speech_seen);
        for text in partials {
            self.emit(Event::Partial(PartialEvent { text }));
        }
        if done {
            self.finish_listen();
        } else if let Some(end) = fell_quiet {
            self.finish_at(end);
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
        if let Some((_, _, listener)) = self.listener.as_mut() {
            if !listen.buffer.is_empty() {
                for event in listener.push(&listen.buffer) {
                    if let Heard::Final(text) = event {
                        finals.push(text);
                    }
                }
            }
            if let Some(Heard::Final(text)) = listener.finish() {
                finals.push(text);
            }
        }
        let for_ask = listen.for_ask;
        self.close(listen);
        let text = finals.join(" ").trim().to_string();
        if text.is_empty() {
            self.go_idle();
            return;
        }
        if for_ask {
            self.spoken_answer(text);
        } else {
            self.think(text, None);
        }
    }

    pub fn listen_timeout(&mut self) {
        let heard = match &self.phase {
            Phase::Listening(listen) => listen.speech_seen,
            _ => false,
        };
        if heard {
            self.finish_listen();
        } else {
            self.go_idle();
        }
    }

    pub fn closed(&mut self, r#gen: u64) {
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
