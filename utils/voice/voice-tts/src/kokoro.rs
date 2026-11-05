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
        let mut samples = audio.samples().to_vec();
        remove_dc(&mut samples, rate);
        Some(Spoken {
            seconds_of_audio: samples.len() as f64 / rate as f64,
            samples,
            sample_rate: rate,
            seconds_of_compute: compute,
        })
    }
}

const DC_CUTOFF_HZ: f32 = 25.0;

fn remove_dc(samples: &mut [f32], rate: i32) {
    let pole = (-2.0 * std::f32::consts::PI * DC_CUTOFF_HZ / rate as f32).exp();
    let (mut last_in, mut last_out) = (0.0f32, 0.0f32);
    for sample in samples.iter_mut() {
        let out = *sample - last_in + pole * last_out;
        last_in = *sample;
        last_out = out;
        *sample = out;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_constant_offset_fades_and_a_voice_band_tone_stays() {
        let rate = 24000;
        let tone = |i: usize| (2.0 * std::f32::consts::PI * 120.0 * i as f32 / rate as f32).sin();
        let mut samples: Vec<f32> = (0..rate as usize).map(|i| 0.3 + 0.5 * tone(i)).collect();
        remove_dc(&mut samples, rate);
        let tail = &samples[rate as usize / 2..];
        let mean = tail.iter().sum::<f32>() / tail.len() as f32;
        let peak = tail.iter().fold(0.0f32, |m, s| m.max(s.abs()));
        assert!(mean.abs() < 0.01, "{mean}");
        assert!(peak > 0.47 && peak < 0.53, "{peak}");
    }
}
