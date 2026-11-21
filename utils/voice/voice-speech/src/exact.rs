use std::path::Path;

use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig};

use crate::SAMPLE_RATE;
use crate::spoken::spoken;

const TAIL: usize = SAMPLE_RATE as usize * 3 / 10;
const FEATURES: i32 = 64;

pub struct Exact {
    recognizer: OfflineRecognizer,
    hotwords: String,
}

impl Exact {
    pub fn open(
        dir: &Path,
        threads: i32,
        hotwords: &[String],
        hotwords_score: f32,
    ) -> Result<Self, String> {
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OfflineRecognizerConfig::default();
        config.feat_config.feature_dim = FEATURES;
        config.model_config.transducer.encoder = file("encoder.int8.onnx");
        config.model_config.transducer.decoder = file("decoder.onnx");
        config.model_config.transducer.joiner = file("joiner.onnx");
        config.model_config.tokens = file("tokens.txt");
        config.model_config.model_type = Some("nemo_transducer".into());
        config.model_config.num_threads = threads;
        config.decoding_method = Some("modified_beam_search".into());
        config.max_active_paths = 4;
        config.hotwords_score = hotwords_score;
        if !hotwords.is_empty() {
            config.model_config.modeling_unit = Some("cjkchar".into());
        }
        let recognizer =
            OfflineRecognizer::create(&config).ok_or("exact asr model did not load")?;
        Ok(Self {
            recognizer,
            hotwords: hotwords.join("\n"),
        })
    }

    pub fn hear(&self, samples: &[f32]) -> String {
        let mut said = spoken(samples);
        said.extend(std::iter::repeat_n(0.0, TAIL));
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
}
