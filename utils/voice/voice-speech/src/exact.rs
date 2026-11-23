use std::path::Path;

use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig};

use crate::SAMPLE_RATE;
use crate::spoken::spoken;

const TAIL: usize = SAMPLE_RATE as usize * 3 / 10;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ExactKind {
    Letters,
    Pieces,
}

impl ExactKind {
    fn features(self) -> i32 {
        match self {
            ExactKind::Letters => 64,
            ExactKind::Pieces => 128,
        }
    }

    fn part(self, name: &str) -> String {
        match self {
            ExactKind::Letters => format!("{name}.onnx"),
            ExactKind::Pieces => format!("{name}.int8.onnx"),
        }
    }

    fn hotword(self, word: &str) -> String {
        match self {
            ExactKind::Letters => word.to_string(),
            ExactKind::Pieces => word.to_lowercase(),
        }
    }
}

pub struct Exact {
    recognizer: OfflineRecognizer,
    hotwords: String,
}

impl Exact {
    pub fn open(
        dir: &Path,
        kind: ExactKind,
        threads: i32,
        hotwords: &[String],
        hotwords_score: f32,
    ) -> Result<Self, String> {
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OfflineRecognizerConfig::default();
        config.feat_config.feature_dim = kind.features();
        config.model_config.transducer.encoder = file("encoder.int8.onnx");
        config.model_config.transducer.decoder = file(&kind.part("decoder"));
        config.model_config.transducer.joiner = file(&kind.part("joiner"));
        config.model_config.tokens = file("tokens.txt");
        config.model_config.model_type = Some("nemo_transducer".into());
        config.model_config.num_threads = threads;
        config.decoding_method = Some("modified_beam_search".into());
        config.max_active_paths = 4;
        config.hotwords_score = hotwords_score;
        if !hotwords.is_empty() {
            match kind {
                ExactKind::Letters => config.model_config.modeling_unit = Some("cjkchar".into()),
                ExactKind::Pieces => {
                    config.model_config.modeling_unit = Some("bpe".into());
                    config.model_config.bpe_vocab = file("bpe.vocab");
                }
            }
        }
        let recognizer =
            OfflineRecognizer::create(&config).ok_or("exact asr model did not load")?;
        let hotwords: Vec<String> = hotwords.iter().map(|word| kind.hotword(word)).collect();
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
            .map(|r| plain(&r.text))
            .unwrap_or_default()
    }
}

fn plain(text: &str) -> String {
    let kept: String = text
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '\'' {
                c
            } else {
                ' '
            }
        })
        .collect();
    kept.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::plain;

    #[test]
    fn punctuation_and_case_of_a_transcript_are_dropped_and_digits_and_apostrophes_kept() {
        assert_eq!(plain("Hey, how are you?"), "hey how are you");
        assert_eq!(plain(" Play Psychosis. "), "play psychosis");
        assert_eq!(plain("Volume 50, let's go!"), "volume 50 let's go");
        assert_eq!(plain("включи психосис"), "включи психосис");
    }
}
