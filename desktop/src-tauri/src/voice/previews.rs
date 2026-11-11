const LOLYA: &[u8] = include_bytes!("../../resources/voice/preview-lolya.wav");
const MORIARTY: &[u8] = include_bytes!("../../resources/voice/preview-moriarty.wav");
const PLACEHOLDER: &[u8] = include_bytes!("../../resources/voice/preview-placeholder.wav");

pub fn clip(voice: &str) -> Option<&'static [u8]> {
    match voice {
        "lolya" => Some(LOLYA),
        "moriarty" => Some(MORIARTY),
        "af_heart" | "am_michael" => Some(PLACEHOLDER),
        _ => None,
    }
}
