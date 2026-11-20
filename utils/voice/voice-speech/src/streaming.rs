use std::path::Path;

use sherpa_onnx::{OnlineRecognizer, OnlineRecognizerConfig, OnlineStream};

use crate::SAMPLE_RATE;

pub struct Streaming {
    recognizer: OnlineRecognizer,
    hotwords: String,
    stream: Option<OnlineStream>,
}

impl Streaming {
    pub fn open(
        dir: &Path,
        threads: i32,
        hotwords: &[String],
        hotwords_score: f32,
    ) -> Result<Self, String> {
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OnlineRecognizerConfig::default();
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
        let recognizer = OnlineRecognizer::create(&config).ok_or("asr model did not load")?;
        Ok(Self {
            recognizer,
            hotwords: hotwords.join("/"),
            stream: None,
        })
    }

    pub fn active(&self) -> bool {
        self.stream.is_some()
    }

    pub fn begin(&mut self, head: &[f32]) {
        let stream = if self.hotwords.is_empty() {
            self.recognizer.create_stream()
        } else {
            self.recognizer.create_stream_with_hotwords(&self.hotwords)
        };
        stream.accept_waveform(SAMPLE_RATE, head);
        self.stream = Some(stream);
        self.decode();
    }

    pub fn accept(&mut self, samples: &[f32]) {
        if let Some(stream) = &self.stream {
            stream.accept_waveform(SAMPLE_RATE, samples);
        }
        self.decode();
    }

    pub fn text(&self) -> Option<String> {
        let stream = self.stream.as_ref()?;
        let result = self.recognizer.get_result(stream)?;
        Some(result.text.trim().to_string())
    }

    pub fn end(&mut self, tail: &[f32]) -> String {
        let Some(stream) = self.stream.take() else {
            return String::new();
        };
        stream.accept_waveform(SAMPLE_RATE, tail);
        stream.input_finished();
        while self.recognizer.is_ready(&stream) {
            self.recognizer.decode(&stream);
        }
        self.recognizer
            .get_result(&stream)
            .map(|r| r.text.trim().to_string())
            .unwrap_or_default()
    }

    pub fn drop_stream(&mut self) {
        self.stream = None;
    }

    fn decode(&self) {
        if let Some(stream) = &self.stream {
            while self.recognizer.is_ready(stream) {
                self.recognizer.decode(stream);
            }
        }
    }
}
