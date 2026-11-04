const PLACEHOLDER: &[u8] = include_bytes!("../../resources/voice/preview-placeholder.wav");

const VOICES: [&str; 5] = ["lolya", "moriarty", "robot", "af_heart", "am_michael"];

pub fn clip(voice: &str) -> Option<&'static [u8]> {
    VOICES.contains(&voice).then_some(PLACEHOLDER)
}
