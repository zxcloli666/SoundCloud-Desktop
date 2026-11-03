use std::collections::VecDeque;
use std::path::PathBuf;

use sherpa_onnx::{SileroVadModelConfig, VadModelConfig, VoiceActivityDetector};

use crate::SAMPLE_RATE;
use crate::batch::Batch;
use crate::streaming::Streaming;

const PREROLL: usize = SAMPLE_RATE as usize / 2;
const TAIL: usize = SAMPLE_RATE as usize * 3 / 10;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Model {
    Zipformer,
    Moonshine,
}

pub struct Options {
    pub vad_model: PathBuf,
    pub asr_dir: PathBuf,
    pub model: Model,
    pub threads: i32,
    pub hotwords: Vec<String>,
    pub hotwords_score: f32,
}

#[derive(Debug, PartialEq)]
pub enum Event {
    Partial(String),
    Final(String),
}

enum Asr {
    Streaming(Streaming),
    Batch(Batch),
}

pub struct Listener {
    vad: VoiceActivityDetector,
    asr: Asr,
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
        let asr = match options.model {
            Model::Zipformer => Asr::Streaming(Streaming::open(
                dir,
                options.threads,
                &options.hotwords,
                options.hotwords_score,
            )?),
            Model::Moonshine => Asr::Batch(Batch::open(dir, options.threads)?),
        };
        Ok(Self {
            vad,
            asr,
            preroll: VecDeque::new(),
            last_partial: String::new(),
        })
    }

    pub fn in_speech(&self) -> bool {
        match &self.asr {
            Asr::Streaming(s) => s.active(),
            Asr::Batch(b) => b.active(),
        }
    }

    pub fn push(&mut self, samples: &[f32]) -> Vec<Event> {
        let mut events = Vec::new();
        self.vad.accept_waveform(samples);
        while !self.vad.is_empty() {
            self.vad.pop();
        }
        let speaking = self.vad.detected();

        if !self.in_speech() {
            self.preroll.extend(samples);
            while self.preroll.len() > PREROLL {
                self.preroll.pop_front();
            }
            if !speaking {
                return events;
            }
            let head: Vec<f32> = self.preroll.drain(..).collect();
            match &mut self.asr {
                Asr::Streaming(s) => s.begin(&head),
                Asr::Batch(b) => b.begin(&head),
            }
        } else {
            match &mut self.asr {
                Asr::Streaming(s) => s.accept(samples),
                Asr::Batch(b) => b.accept(samples),
            }
        }

        if let Asr::Streaming(s) = &self.asr
            && let Some(text) = s.text()
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
        if !self.in_speech() {
            return None;
        }
        let tail = vec![0.0; TAIL];
        let text = match &mut self.asr {
            Asr::Streaming(s) => s.end(&tail),
            Asr::Batch(b) => b.end(&tail),
        };
        self.last_partial.clear();
        self.vad.reset();
        if text.is_empty() {
            None
        } else {
            Some(Event::Final(text))
        }
    }

    pub fn reset(&mut self) {
        match &mut self.asr {
            Asr::Streaming(s) => s.drop_stream(),
            Asr::Batch(b) => b.drop_stream(),
        }
        self.preroll.clear();
        self.last_partial.clear();
        self.vad.reset();
    }
}
