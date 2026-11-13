const LOLI: &[u8] = include_bytes!("../../resources/voice/preview-loli.wav");
const MORIARTY: &[u8] = include_bytes!("../../resources/voice/preview-moriarty.wav");
const HEART: &[u8] = include_bytes!("../../resources/voice/preview-af-heart.wav");
const MICHAEL: &[u8] = include_bytes!("../../resources/voice/preview-am-michael.wav");

pub fn clip(voice: &str) -> Option<&'static [u8]> {
    match voice {
        "loli" => Some(LOLI),
        "moriarty" => Some(MORIARTY),
        "af_heart" => Some(HEART),
        "am_michael" => Some(MICHAEL),
        _ => None,
    }
}
