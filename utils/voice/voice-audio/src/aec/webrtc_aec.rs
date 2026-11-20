use webrtc_audio_processing::Processor;
use webrtc_audio_processing::config::{
    Config, EchoCanceller, NoiseSuppression, NoiseSuppressionLevel,
};

use super::AecConfig;

pub struct WebrtcAec {
    processor: Processor,
    render_frame: Vec<f32>,
}

impl WebrtcAec {
    pub fn new(config: AecConfig) -> Result<Self, String> {
        let processor = Processor::new(config.sample_rate).map_err(|e| e.to_string())?;
        processor.set_config(Config {
            echo_canceller: Some(EchoCanceller::Full {
                stream_delay_ms: config.delay_ms,
            }),
            noise_suppression: config.noise_suppression.then_some(NoiseSuppression {
                level: NoiseSuppressionLevel::Moderate,
                analyze_linear_aec_output: false,
            }),
            ..Default::default()
        });
        Ok(Self {
            processor,
            render_frame: vec![0.0; config.frame_len()],
        })
    }

    pub fn render(&mut self, frame: &[f32]) -> Result<(), String> {
        self.render_frame.copy_from_slice(frame);
        self.processor
            .process_render_frame([&mut self.render_frame])
            .map_err(|e| e.to_string())
    }

    pub fn capture(&mut self, frame: &[f32], out: &mut [f32]) -> Result<(), String> {
        out.copy_from_slice(frame);
        self.processor
            .process_capture_frame([&mut *out])
            .map_err(|e| e.to_string())
    }
}
