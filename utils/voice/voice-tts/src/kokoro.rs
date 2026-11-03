use sherpa_onnx::{
    GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsKokoroModelConfig, OfflineTtsModelConfig,
};
use std::path::Path;
use std::time::Instant;

pub struct Kokoro {
    tts: OfflineTts,
}

pub struct Spoken {
    pub samples: Vec<f32>,
    pub sample_rate: i32,
    pub seconds_of_audio: f64,
    pub seconds_of_compute: f64,
}

impl Kokoro {
    pub fn open(dir: &Path, model: &str, threads: i32) -> Option<Self> {
        let path = |name: &str| Some(dir.join(name).to_string_lossy().into_owned());
        let config = OfflineTtsConfig {
            model: OfflineTtsModelConfig {
                kokoro: OfflineTtsKokoroModelConfig {
                    model: path(model),
                    voices: path("voices.bin"),
                    tokens: path("tokens.txt"),
                    ..Default::default()
                },
                num_threads: threads,
                ..Default::default()
            },
            max_num_sentences: 1,
            ..Default::default()
        };
        Some(Kokoro { tts: OfflineTts::create(&config)? })
    }

    pub fn speak(&self, sentences: &[String], sid: i32, speed: f32) -> Option<Spoken> {
        let codepoints: Vec<Vec<i32>> = sentences
            .iter()
            .map(|s| s.chars().map(|c| c as i32).collect())
            .collect();
        let config = GenerationConfig {
            sid,
            speed,
            phoneme_codepoints: Some(codepoints),
            ..Default::default()
        };
        let started = Instant::now();
        let audio = self.tts.generate_with_config("", &config, None::<fn(&[f32], f32) -> bool>)?;
        let compute = started.elapsed().as_secs_f64();
        let rate = audio.sample_rate();
        let samples = audio.samples().to_vec();
        Some(Spoken {
            seconds_of_audio: samples.len() as f64 / rate as f64,
            samples,
            sample_rate: rate,
            seconds_of_compute: compute,
        })
    }
}
