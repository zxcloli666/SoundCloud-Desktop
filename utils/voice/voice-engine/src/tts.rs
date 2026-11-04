use std::path::PathBuf;
use std::sync::mpsc::{Sender, channel};

use signalsmith_stretch::Stretch;
use voice_g2p::en::{English, Lexicon};
use voice_g2p::kokoro::{map_russian, split_sentences};
use voice_g2p::ru::Russian;
use voice_tts::Kokoro;

use crate::clip::Clip;
use crate::config::Language;
use crate::voices::Voice;

const THREADS: i32 = 2;

pub struct Job {
    pub r#gen: u64,
    pub text: String,
    pub language: Language,
    pub voice: &'static Voice,
    pub dir: PathBuf,
    pub speed: f32,
    pub pitch: f32,
}

pub type Reply = Box<dyn Fn(u64, Result<Clip, String>) + Send>;

pub struct Tts {
    jobs: Sender<Job>,
}

struct Frontends {
    russian: Option<Russian>,
    english: Option<English>,
    kokoro: Option<(PathBuf, Kokoro)>,
}

impl Tts {
    pub fn start(reply: Reply) -> Tts {
        let (jobs, inbox) = channel::<Job>();
        std::thread::Builder::new()
            .name("voice-tts".into())
            .spawn(move || {
                let mut frontends = Frontends {
                    russian: None,
                    english: None,
                    kokoro: None,
                };
                for job in inbox {
                    let result = frontends.synth(&job);
                    reply(job.r#gen, result);
                }
            })
            .expect("spawn voice-tts");
        Tts { jobs }
    }

    pub fn say(&self, job: Job) {
        let _ = self.jobs.send(job);
    }
}

impl Frontends {
    fn synth(&mut self, job: &Job) -> Result<Clip, String> {
        let ipa = match job.language {
            Language::Ru => {
                let russian = self.russian.get_or_insert_with(Russian::bundled);
                map_russian(&russian.speak(&job.text).ipa)
            }
            Language::En => {
                let english = self
                    .english
                    .get_or_insert_with(|| English::new(Lexicon::bundled()));
                english.phonemize(&job.text).text
            }
        };
        let fresh = !matches!(&self.kokoro, Some((dir, _)) if *dir == job.dir);
        if fresh {
            self.kokoro = None;
            let kokoro =
                Kokoro::open(&job.dir, job.voice.file, THREADS).ok_or("tts model did not load")?;
            self.kokoro = Some((job.dir.clone(), kokoro));
        }
        let (_, kokoro) = self.kokoro.as_ref().ok_or("tts model did not load")?;
        let speed = job.speed.clamp(0.5, 2.0);
        let spoken = kokoro
            .speak(&split_sentences(&ipa), job.voice.speaker, speed)
            .ok_or("tts produced no audio")?;
        let rate = spoken.sample_rate.max(1) as u32;
        let samples = if job.pitch.abs() >= 0.05 {
            shift(&spoken.samples, rate, job.pitch.clamp(-12.0, 12.0))
        } else {
            spoken.samples
        };
        Ok(Clip { samples, rate })
    }
}

fn shift(samples: &[f32], rate: u32, semitones: f32) -> Vec<f32> {
    let mut stretch = Stretch::preset_default(1, rate);
    stretch.set_transpose_factor_semitones(semitones, None);
    let mut out = vec![0.0; samples.len()];
    stretch.exact(samples, &mut out);
    out
}
