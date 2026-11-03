pub const KOKORO: &str = "kokoro-int8-multi-lang-v1_0";

pub struct Voice {
    pub id: &'static str,
    pub model: &'static str,
    pub file: &'static str,
    pub speaker: i32,
}

const VOICES: [Voice; 2] = [
    Voice {
        id: "af_heart",
        model: KOKORO,
        file: "model.int8.onnx",
        speaker: 3,
    },
    Voice {
        id: "am_michael",
        model: KOKORO,
        file: "model.int8.onnx",
        speaker: 16,
    },
];

pub fn find(id: &str) -> Option<&'static Voice> {
    VOICES.iter().find(|v| v.id == id)
}
