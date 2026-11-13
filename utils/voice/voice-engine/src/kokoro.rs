use std::path::{Path, PathBuf};

use signalsmith_stretch::Stretch;
use voice_g2p::en::{English, Lexicon};
use voice_g2p::kokoro::{map_russian, split_sentences};
use voice_g2p::ru::Russian;
use voice_tts::Kokoro;

use crate::clip::Clip;
use crate::config::Language;

const FEWEST_THREADS: usize = 2;
const MOST_THREADS: usize = 4;

pub struct Line<'a> {
    pub text: &'a str,
    pub language: Language,
    pub dir: &'a Path,
    pub file: &'a str,
    pub speaker: i32,
    pub speed: f32,
    pub pitch: f32,
}

#[derive(Default)]
pub struct Frontends {
    russian: Option<Russian>,
    english: Option<English>,
    kokoro: Option<(PathBuf, Kokoro)>,
}

impl Frontends {
    pub fn synth(&mut self, line: &Line) -> Result<Clip, String> {
        let ipa = match line.language {
            Language::Ru => {
                let russian = self.russian.get_or_insert_with(Russian::bundled);
                map_russian(&russian.speak(line.text).ipa)
            }
            Language::En => {
                let english = self
                    .english
                    .get_or_insert_with(|| English::new(Lexicon::bundled()));
                english.phonemize(line.text).text
            }
        };
        let fresh = !matches!(&self.kokoro, Some((dir, _)) if dir == line.dir);
        if fresh {
            self.kokoro = None;
            let kokoro =
                Kokoro::open(line.dir, line.file, threads()).ok_or("tts model did not load")?;
            self.kokoro = Some((line.dir.to_path_buf(), kokoro));
        }
        let (_, kokoro) = self.kokoro.as_ref().ok_or("tts model did not load")?;
        let speed = line.speed.clamp(0.5, 2.0);
        let spoken = kokoro
            .speak(&split_sentences(&ipa), line.speaker, speed)
            .ok_or("tts produced no audio")?;
        let rate = spoken.sample_rate.max(1) as u32;
        let samples = if line.pitch.abs() >= 0.05 {
            shift(&spoken.samples, rate, line.pitch.clamp(-12.0, 12.0))
        } else {
            spoken.samples
        };
        Ok(Clip { samples, rate })
    }
}

fn threads() -> i32 {
    let cores = std::thread::available_parallelism().map_or(FEWEST_THREADS, |cores| cores.get());
    (cores / 2).clamp(FEWEST_THREADS, MOST_THREADS) as i32
}

fn shift(samples: &[f32], rate: u32, semitones: f32) -> Vec<f32> {
    let mut stretch = Stretch::preset_default(1, rate);
    stretch.set_transpose_factor_semitones(semitones, None);
    let mut out = vec![0.0; samples.len()];
    stretch.exact(samples, &mut out);
    out
}
