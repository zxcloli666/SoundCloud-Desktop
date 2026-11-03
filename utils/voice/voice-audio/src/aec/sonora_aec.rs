use sonora::config::{EchoCanceller, NoiseSuppression};
use sonora::{AudioProcessing, Config, StreamConfig};

use super::AecConfig;

pub struct SonoraAec {
    apm: AudioProcessing,
    delay_ms: Option<u16>,
    scratch: Vec<f32>,
}

impl SonoraAec {
    pub fn new(config: AecConfig) -> Result<Self, String> {
        if config.sample_rate != 16_000 && config.sample_rate != 48_000 {
            return Err(format!("unsupported sample rate {}", config.sample_rate));
        }
        let apm_config = Config {
            echo_canceller: Some(EchoCanceller::default()),
            noise_suppression: config.noise_suppression.then(NoiseSuppression::default),
            ..Default::default()
        };
        let stream = StreamConfig::new(config.sample_rate, 1);
        let apm = AudioProcessing::builder()
            .config(apm_config)
            .capture_config(stream)
            .render_config(stream)
            .build();
        Ok(Self {
            apm,
            delay_ms: config.delay_ms,
            scratch: vec![0.0; config.frame_len()],
        })
    }

    pub fn render(&mut self, frame: &[f32]) -> Result<(), String> {
        self.apm
            .process_render_f32(&[frame], &mut [&mut self.scratch[..]])
            .map_err(|e| e.to_string())
    }

    pub fn capture(&mut self, frame: &[f32], out: &mut [f32]) -> Result<(), String> {
        if let Some(delay) = self.delay_ms {
            self.apm
                .set_stream_delay_ms(delay as i32)
                .map_err(|e| e.to_string())?;
        }
        self.apm
            .process_capture_f32(&[frame], &mut [out])
            .map_err(|e| e.to_string())
    }
}
