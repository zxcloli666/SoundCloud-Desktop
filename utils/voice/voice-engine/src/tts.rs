use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{RecvTimeoutError, Sender, channel};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use voice_qwen::{Paths, Qwen, RATE, Sink};

use crate::cache::{self, Cache};
use crate::clip::Clip;
use crate::config::Language;
use crate::kokoro::{Frontends, Line};
use crate::qwen;
use crate::server::{Ask, Server};
use crate::shape::Shaper;

const REST: Duration = Duration::from_secs(120);

pub trait Voice: Send {
    fn rate(&self) -> u32;
    fn say(&mut self, text: &str, sink: &mut dyn Sink) -> Result<(), String>;
}

#[derive(Clone)]
pub enum Source {
    Kokoro {
        dir: PathBuf,
        file: &'static str,
        speaker: i32,
    },
    Qwen {
        paths: Paths,
        speaker: &'static str,
        cached_as: String,
    },
    Server {
        voice: &'static str,
        cached_as: String,
        server: Arc<dyn Server>,
        local: Option<Box<Source>>,
    },
    Given(Arc<Mutex<dyn Voice>>),
}

pub struct Say {
    pub r#gen: u64,
    pub text: String,
    pub language: Language,
    pub source: Source,
    pub speed: f32,
    pub pitch: f32,
    pub kept: bool,
}

pub enum Piece {
    Audio { rate: u32, samples: Vec<f32> },
    End,
    Failed(String),
    Again,
    Trouble(String),
}

pub type Reply = Box<dyn Fn(u64, Piece) + Send>;

enum Job {
    Warm(Paths, &'static str),
    Say(Say),
}

pub struct Tts {
    jobs: Sender<Job>,
    floor: Arc<AtomicU64>,
}

struct Voices {
    kokoro: Frontends,
    qwen: Qwen,
    cache: Cache,
}

struct Out<'a> {
    r#gen: u64,
    reply: &'a Reply,
    floor: &'a AtomicU64,
}

struct Live<'a> {
    out: &'a Out<'a>,
    shaper: &'a mut Shaper,
    raw: Vec<f32>,
}

struct Plain<'a> {
    out: &'a Out<'a>,
    rate: u32,
}

impl Tts {
    pub fn start(reply: Reply, phrases: PathBuf) -> Tts {
        let (jobs, inbox) = channel::<Job>();
        let floor = Arc::new(AtomicU64::new(0));
        let asked = floor.clone();
        std::thread::Builder::new()
            .name("voice-tts".into())
            .spawn(move || {
                let mut voices = Voices {
                    kokoro: Frontends::default(),
                    qwen: Qwen::default(),
                    cache: Cache::new(phrases),
                };
                loop {
                    match inbox.recv_timeout(REST) {
                        Ok(Job::Warm(paths, speaker)) => {
                            let at = asked.load(Ordering::Relaxed);
                            let busy = || asked.load(Ordering::Relaxed) != at;
                            voices.qwen.warm(&paths, &qwen::trial(speaker), &busy);
                            voices.tell(&reply);
                        }
                        Ok(Job::Say(say)) => {
                            let out = Out {
                                r#gen: say.r#gen,
                                reply: &reply,
                                floor: &asked,
                            };
                            let floor = asked.load(Ordering::Relaxed);
                            if out.wanted() && !voices.say(&say, &out) {
                                let _ = asked.compare_exchange(
                                    floor,
                                    u64::MAX,
                                    Ordering::Relaxed,
                                    Ordering::Relaxed,
                                );
                            }
                            voices.tell(&reply);
                        }
                        Err(RecvTimeoutError::Timeout) => voices.qwen.rest(),
                        Err(RecvTimeoutError::Disconnected) => return,
                    }
                }
            })
            .expect("spawn voice-tts");
        Tts { jobs, floor }
    }

    pub fn say(&self, say: Say) {
        self.floor.store(say.r#gen, Ordering::Relaxed);
        self.then(say);
    }

    pub fn then(&self, say: Say) {
        let _ = self.jobs.send(Job::Say(say));
    }

    pub fn warm(&self, paths: Paths, speaker: &'static str) {
        let _ = self.jobs.send(Job::Warm(paths, speaker));
    }

    pub fn forget(&self) {
        self.floor.store(u64::MAX, Ordering::Relaxed);
    }
}

impl Out<'_> {
    fn wanted(&self) -> bool {
        self.r#gen >= self.floor.load(Ordering::Relaxed)
    }

    fn audio(&self, rate: u32, samples: Vec<f32>) {
        if !samples.is_empty() {
            (self.reply)(self.r#gen, Piece::Audio { rate, samples });
        }
    }

    fn again(&self) {
        (self.reply)(self.r#gen, Piece::Again);
    }
}

impl Sink for Live<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.raw.extend_from_slice(&samples);
        self.out.audio(RATE, self.shaper.push(samples));
    }

    fn wanted(&self) -> bool {
        self.out.wanted()
    }

    fn again(&mut self) {
        self.out.again();
    }
}

impl Sink for Plain<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.out.audio(self.rate, samples);
    }

    fn wanted(&self) -> bool {
        self.out.wanted()
    }

    fn again(&mut self) {
        self.out.again();
    }
}

impl Voices {
    fn tell(&mut self, reply: &Reply) {
        for trouble in self.qwen.troubles() {
            reply(0, Piece::Trouble(trouble));
        }
    }

    fn say(&mut self, say: &Say, out: &Out) -> bool {
        let result = self.speak(say, &say.source, out);
        let spoke = result.is_ok();
        let piece = match result {
            Ok(()) => Piece::End,
            Err(error) => Piece::Failed(error),
        };
        (out.reply)(out.r#gen, piece);
        spoke
    }

    fn speak(&mut self, say: &Say, source: &Source, out: &Out) -> Result<(), String> {
        match source {
            Source::Kokoro { dir, file, speaker } => self.kokoro(say, dir, file, *speaker, out),
            Source::Qwen {
                paths,
                speaker,
                cached_as,
            } => self.qwen(say, paths, speaker, cached_as, out),
            Source::Server {
                voice,
                cached_as,
                server,
                local,
            } => self.server(
                say,
                voice,
                cached_as,
                server.as_ref(),
                local.as_deref(),
                out,
            ),
            Source::Given(voice) => given(say, voice, out),
        }
    }

    fn kokoro(
        &mut self,
        say: &Say,
        dir: &std::path::Path,
        file: &str,
        speaker: i32,
        out: &Out,
    ) -> Result<(), String> {
        let clip = self.kokoro.synth(&Line {
            text: &say.text,
            language: say.language,
            dir,
            file,
            speaker,
            speed: say.speed,
            pitch: say.pitch,
        })?;
        out.audio(clip.rate, clip.samples);
        Ok(())
    }

    fn qwen(
        &mut self,
        say: &Say,
        paths: &Paths,
        speaker: &str,
        cached_as: &str,
        out: &Out,
    ) -> Result<(), String> {
        let Some(key) = self.to_make(say, cached_as, out) else {
            return Ok(());
        };
        let mut shaper = Shaper::new(RATE, say.speed, say.pitch);
        let mut live = Live {
            out,
            shaper: &mut shaper,
            raw: Vec::new(),
        };
        let request = qwen::request(&say.text, speaker);
        self.qwen.say(paths, &request, &mut live)?;
        let raw = live.raw;
        if !out.wanted() {
            return Ok(());
        }
        out.audio(RATE, shaper.finish());
        self.keep(say, &key, raw);
        Ok(())
    }

    fn server(
        &mut self,
        say: &Say,
        voice: &str,
        cached_as: &str,
        server: &dyn Server,
        local: Option<&Source>,
        out: &Out,
    ) -> Result<(), String> {
        let Some(key) = self.to_make(say, cached_as, out) else {
            return Ok(());
        };
        let ask = Ask {
            voice,
            text: &say.text,
            kept: say.kept,
        };
        let said = server.say(&ask, &|| out.wanted()).and_then(at_rate);
        if !out.wanted() {
            return Ok(());
        }
        match said {
            Ok(clip) => {
                shaped(say, clip.samples.clone(), out);
                self.keep(say, &key, clip.samples);
                Ok(())
            }
            Err(error) => self.instead(say, local, error, out),
        }
    }

    fn instead(
        &mut self,
        say: &Say,
        local: Option<&Source>,
        error: String,
        out: &Out,
    ) -> Result<(), String> {
        let Some(local) = local else {
            return Err(error);
        };
        let trouble = format!("server voice failed, speaking on this computer: {error}");
        (out.reply)(out.r#gen, Piece::Trouble(trouble));
        self.speak(say, local, out)
    }

    fn to_make(&self, say: &Say, cached_as: &str, out: &Out) -> Option<String> {
        if !say.text.chars().any(char::is_alphanumeric) {
            return None;
        }
        let key = cache::key(&[cached_as, &say.text]);
        match self.cache.get(&key).filter(|clip| clip.rate == RATE) {
            Some(clip) => {
                shaped(say, clip.samples, out);
                None
            }
            None => Some(key),
        }
    }

    fn keep(&self, say: &Say, key: &str, samples: Vec<f32>) {
        if say.kept {
            self.cache.put(
                key,
                &Clip {
                    samples,
                    rate: RATE,
                },
            );
        }
    }
}

fn shaped(say: &Say, samples: Vec<f32>, out: &Out) {
    let mut shaper = Shaper::new(RATE, say.speed, say.pitch);
    out.audio(RATE, shaper.push(samples));
    out.audio(RATE, shaper.finish());
}

fn at_rate(clip: Clip) -> Result<Clip, String> {
    if clip.rate == RATE {
        Ok(clip)
    } else {
        Err(format!("the server voice came at {} Hz", clip.rate))
    }
}

fn given(say: &Say, voice: &Mutex<dyn Voice>, out: &Out) -> Result<(), String> {
    let mut voice = voice.lock().map_err(|_| "the voice is broken")?;
    let rate = voice.rate();
    voice.say(&say.text, &mut Plain { out, rate })
}
