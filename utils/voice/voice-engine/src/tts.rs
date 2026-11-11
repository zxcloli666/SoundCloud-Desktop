use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::sync::mpsc::{RecvTimeoutError, Sender, channel};
use std::time::Duration;

use voice_qwen::Sink;

use crate::cache::{self, Cache};
use crate::clip::Clip;
use crate::config::Language;
use crate::kokoro::{Frontends, Line};
use crate::qwen::{self, Paths, Qwen};
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
    Given(Arc<Mutex<dyn Voice>>),
}

pub struct Say {
    pub r#gen: u64,
    pub text: String,
    pub language: Language,
    pub source: Source,
    pub speed: f32,
    pub pitch: f32,
}

pub enum Piece {
    Audio { rate: u32, samples: Vec<f32> },
    End,
    Failed(String),
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
                            voices.qwen.warm(&paths, speaker, &busy);
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
}

impl Sink for Live<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.raw.extend_from_slice(&samples);
        self.out.audio(qwen::RATE, self.shaper.push(samples));
    }

    fn wanted(&self) -> bool {
        self.out.wanted()
    }
}

impl Sink for Plain<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.out.audio(self.rate, samples);
    }

    fn wanted(&self) -> bool {
        self.out.wanted()
    }
}

impl Voices {
    fn say(&mut self, say: &Say, out: &Out) -> bool {
        let result = match &say.source {
            Source::Kokoro { dir, file, speaker } => self.kokoro(say, dir, file, *speaker, out),
            Source::Qwen {
                paths,
                speaker,
                cached_as,
            } => self.qwen(say, paths, speaker, cached_as, out),
            Source::Given(voice) => given(say, voice, out),
        };
        let spoke = result.is_ok();
        let piece = match result {
            Ok(()) => Piece::End,
            Err(error) => Piece::Failed(error),
        };
        (out.reply)(out.r#gen, piece);
        spoke
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
        let mut shaper = Shaper::new(qwen::RATE, say.speed, say.pitch);
        let key = cache::key(&[cached_as, &say.text]);
        if let Some(clip) = self.cache.get(&key).filter(|clip| clip.rate == qwen::RATE) {
            out.audio(qwen::RATE, shaper.push(clip.samples));
            out.audio(qwen::RATE, shaper.finish());
            return Ok(());
        }
        let mut live = Live {
            out,
            shaper: &mut shaper,
            raw: Vec::new(),
        };
        self.qwen.say(paths, speaker, &say.text, &mut live)?;
        let raw = live.raw;
        if out.wanted() {
            out.audio(qwen::RATE, shaper.finish());
            self.cache.put(
                &key,
                &Clip {
                    samples: raw,
                    rate: qwen::RATE,
                },
            );
        }
        Ok(())
    }
}

fn given(say: &Say, voice: &Mutex<dyn Voice>, out: &Out) -> Result<(), String> {
    let mut voice = voice.lock().map_err(|_| "the voice is broken")?;
    let rate = voice.rate();
    voice.say(&say.text, &mut Plain { out, rate })
}
