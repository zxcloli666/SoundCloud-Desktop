mod sonora_aec;
#[cfg(feature = "webrtc")]
mod webrtc_aec;

pub use sonora_aec::SonoraAec;
#[cfg(feature = "webrtc")]
pub use webrtc_aec::WebrtcAec;

#[derive(Debug, Clone, Copy)]
pub struct AecConfig {
    pub sample_rate: u32,
    pub noise_suppression: bool,
    pub delay_ms: Option<u16>,
}

impl AecConfig {
    pub fn frame_len(&self) -> usize {
        self.sample_rate as usize / 100
    }
}
