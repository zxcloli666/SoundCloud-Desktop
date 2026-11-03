use std::collections::VecDeque;
use std::path::PathBuf;

use sherpa_onnx::{
    OnlineRecognizer, OnlineRecognizerConfig, OnlineStream, SileroVadModelConfig, VadModelConfig,
    VoiceActivityDetector,
};

use crate::SAMPLE_RATE;

const PREROLL: usize = SAMPLE_RATE as usize / 2;
const TAIL: usize = SAMPLE_RATE as usize * 3 / 10;

pub struct Options {
    pub vad_model: PathBuf,
    pub asr_dir: PathBuf,
    pub threads: i32,
    pub hotwords: Vec<String>,
    pub hotwords_score: f32,
}

#[derive(Debug, PartialEq)]
pub enum Event {
    Partial(String),
    Final(String),
}

pub struct Listener {
    vad: VoiceActivityDetector,
    recognizer: OnlineRecognizer,
    hotwords: String,
    stream: Option<OnlineStream>,
    preroll: VecDeque<f32>,
    last_partial: String,
}

impl Listener {
    pub fn open(options: &Options) -> Result<Self, String> {
        let vad_config = VadModelConfig {
            silero_vad: SileroVadModelConfig {
                model: Some(options.vad_model.display().to_string()),
                threshold: 0.5,
                min_silence_duration: 0.5,
                min_speech_duration: 0.1,
                window_size: 512,
                max_speech_duration: 20.0,
            },
            sample_rate: SAMPLE_RATE,
            num_threads: 1,
            provider: Some("cpu".into()),
            ..Default::default()
        };
        let vad =
            VoiceActivityDetector::create(&vad_config, 30.0).ok_or("vad model did not load")?;

        let dir = &options.asr_dir;
        let file = |name: &str| Some(dir.join(name).display().to_string());
        let mut config = OnlineRecognizerConfig::default();
        config.model_config.transducer.encoder = file("encoder.int8.onnx");
        config.model_config.transducer.decoder = file("decoder.onnx");
        config.model_config.transducer.joiner = file("joiner.int8.onnx");
        config.model_config.tokens = file("tokens.txt");
        config.model_config.num_threads = options.threads;
        config.decoding_method = Some("modified_beam_search".into());
        config.max_active_paths = 4;
        config.hotwords_score = options.hotwords_score;
        if !options.hotwords.is_empty() {
            config.model_config.modeling_unit = Some("bpe".into());
            config.model_config.bpe_vocab = file("bpe.vocab");
        }
        let recognizer = OnlineRecognizer::create(&config).ok_or("asr model did not load")?;

        Ok(Self {
            vad,
            recognizer,
            hotwords: options.hotwords.join("/"),
            stream: None,
            preroll: VecDeque::new(),
            last_partial: String::new(),
        })
    }

    pub fn push(&mut self, samples: &[f32]) -> Vec<Event> {
        let mut events = Vec::new();
        self.vad.accept_waveform(samples);
        while !self.vad.is_empty() {
            self.vad.pop();
        }
        let speaking = self.vad.detected();

        if self.stream.is_none() {
            self.preroll.extend(samples);
            while self.preroll.len() > PREROLL {
                self.preroll.pop_front();
            }
            if !speaking {
                return events;
            }
            let stream = if self.hotwords.is_empty() {
                self.recognizer.create_stream()
            } else {
                self.recognizer.create_stream_with_hotwords(&self.hotwords)
            };
            let head: Vec<f32> = self.preroll.drain(..).collect();
            stream.accept_waveform(SAMPLE_RATE, &head);
            self.stream = Some(stream);
        } else if let Some(stream) = &self.stream {
            stream.accept_waveform(SAMPLE_RATE, samples);
        }

        self.decode();
        if let Some(text) = self.current_text()
            && text != self.last_partial
            && !text.is_empty()
        {
            self.last_partial = text.clone();
            events.push(Event::Partial(text));
        }
        if !speaking {
            events.extend(self.finish());
        }
        events
    }

    pub fn finish(&mut self) -> Option<Event> {
        let stream = self.stream.take()?;
        stream.accept_waveform(SAMPLE_RATE, &vec![0.0; TAIL]);
        stream.input_finished();
        while self.recognizer.is_ready(&stream) {
            self.recognizer.decode(&stream);
        }
        let text = self
            .recognizer
            .get_result(&stream)
            .map(|r| r.text.trim().to_string())
            .unwrap_or_default();
        self.last_partial.clear();
        self.vad.reset();
        if text.is_empty() {
            None
        } else {
            Some(Event::Final(text))
        }
    }

    fn decode(&self) {
        if let Some(stream) = &self.stream {
            while self.recognizer.is_ready(stream) {
                self.recognizer.decode(stream);
            }
        }
    }

    fn current_text(&self) -> Option<String> {
        let stream = self.stream.as_ref()?;
        let result = self.recognizer.get_result(stream)?;
        Some(result.text.trim().to_string())
    }
}
