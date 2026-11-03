#[cfg(feature = "webrtc")]
use voice_audio::aec::WebrtcAec;
use voice_audio::aec::{AecConfig, SonoraAec};

pub enum Engine {
    Sonora(SonoraAec),
    #[cfg(feature = "webrtc")]
    Webrtc(WebrtcAec),
}

impl Engine {
    pub fn new(name: &str, config: AecConfig) -> Result<Self, String> {
        match name {
            "sonora" => Ok(Engine::Sonora(SonoraAec::new(config)?)),
            #[cfg(feature = "webrtc")]
            "webrtc" => Ok(Engine::Webrtc(WebrtcAec::new(config)?)),
            other => Err(format!("engine {other} is not built in")),
        }
    }

    pub fn render(&mut self, frame: &[f32]) {
        match self {
            Engine::Sonora(e) => e.render(frame).unwrap(),
            #[cfg(feature = "webrtc")]
            Engine::Webrtc(e) => e.render(frame).unwrap(),
        }
    }

    pub fn capture(&mut self, frame: &[f32], out: &mut [f32]) {
        match self {
            Engine::Sonora(e) => e.capture(frame, out).unwrap(),
            #[cfg(feature = "webrtc")]
            Engine::Webrtc(e) => e.capture(frame, out).unwrap(),
        }
    }
}
