use std::path::Path;

use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig};

use crate::SAMPLE_RATE;

pub struct Batch {
    recognizer: OfflineRecognizer,
    samples: Vec<f32>,
    active: bool,
}

impl Batch {
    pub fn open(dir: &Path, threads: i32) -> Result<Self, String> {
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OfflineRecognizerConfig::default();
        config.model_config.tokens = file("tokens.txt");
        config.model_config.num_threads = threads;
        config.decoding_method = Some("greedy_search".into());
        config.model_config.moonshine.encoder = file("encoder_model.ort");
        config.model_config.moonshine.merged_decoder = file("decoder_model_merged.ort");
        let recognizer = OfflineRecognizer::create(&config).ok_or("asr model did not load")?;
        Ok(Self {
            recognizer,
            samples: Vec::new(),
            active: false,
        })
    }

    pub fn active(&self) -> bool {
        self.active
    }

    pub fn begin(&mut self, head: &[f32]) {
        self.samples.clear();
        self.samples.extend_from_slice(head);
        self.active = true;
    }

    pub fn accept(&mut self, samples: &[f32]) {
        if self.active {
            self.samples.extend_from_slice(samples);
        }
    }

    pub fn end(&mut self, tail: &[f32]) -> String {
        if !self.active {
            return String::new();
        }
        self.active = false;
        self.samples.extend_from_slice(tail);
        let stream = self.recognizer.create_stream();
        stream.accept_waveform(SAMPLE_RATE, &self.samples);
        self.recognizer.decode(&stream);
        self.samples.clear();
        stream
            .get_result()
            .map(|r| r.text.trim().to_string())
            .unwrap_or_default()
    }

    pub fn drop_stream(&mut self) {
        self.active = false;
        self.samples.clear();
    }
}
