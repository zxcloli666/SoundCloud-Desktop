use std::path::Path;

use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig};

use crate::SAMPLE_RATE;
use crate::spoken::spoken;

pub struct Batch {
    recognizer: OfflineRecognizer,
    hotwords: String,
    samples: Vec<f32>,
    active: bool,
}

impl Batch {
    pub fn open(
        dir: &Path,
        threads: i32,
        hotwords: &[String],
        hotwords_score: f32,
    ) -> Result<Self, String> {
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OfflineRecognizerConfig::default();
        config.model_config.transducer.encoder = file("encoder.int8.onnx");
        config.model_config.transducer.decoder = file("decoder.onnx");
        config.model_config.transducer.joiner = file("joiner.int8.onnx");
        config.model_config.tokens = file("tokens.txt");
        config.model_config.num_threads = threads;
        config.decoding_method = Some("modified_beam_search".into());
        config.max_active_paths = 4;
        config.hotwords_score = hotwords_score;
        if !hotwords.is_empty() {
            config.model_config.modeling_unit = Some("bpe".into());
            config.model_config.bpe_vocab = file("bpe.vocab");
        }
        let recognizer = OfflineRecognizer::create(&config).ok_or("asr model did not load")?;
        Ok(Self {
            recognizer,
            hotwords: hotwords.join("/"),
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
        let mut said = spoken(&self.samples);
        said.extend_from_slice(tail);
        self.samples.clear();
        let stream = if self.hotwords.is_empty() {
            self.recognizer.create_stream()
        } else {
            self.recognizer.create_stream_with_hotwords(&self.hotwords)
        };
        stream.accept_waveform(SAMPLE_RATE, &said);
        self.recognizer.decode(&stream);
        stream
            .get_result()
            .map(|r| r.text.trim().to_lowercase())
            .unwrap_or_default()
    }

    pub fn drop_stream(&mut self) {
        self.active = false;
        self.samples.clear();
    }
}
