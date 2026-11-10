pub const KOKORO: &str = "kokoro-int8-multi-lang-v1_0";
pub const QWEN_CODEC: &str = "qwen-codec";
pub const QWEN_CODEC_FILE: &str = "qwen-tokenizer-12hz-Q8_0.gguf";

pub enum Kind {
    Kokoro {
        file: &'static str,
        speaker: i32,
    },
    Qwen {
        file: &'static str,
        speaker: &'static str,
        robot: bool,
    },
}

pub struct Voice {
    pub id: &'static str,
    pub model: &'static str,
    pub kind: Kind,
}

const LOLYA: &str = "qwen-lolya";
const LOLYA_FILE: &str = "qwen-talker-1.7b-lolya-Q4_K_M.gguf";

const VOICES: [Voice; 5] = [
    Voice {
        id: "lolya",
        model: LOLYA,
        kind: Kind::Qwen {
            file: LOLYA_FILE,
            speaker: "lolya",
            robot: false,
        },
    },
    Voice {
        id: "moriarty",
        model: "qwen-moriarty",
        kind: Kind::Qwen {
            file: "qwen-talker-1.7b-moriarty-Q4_K_M.gguf",
            speaker: "moriarty",
            robot: false,
        },
    },
    Voice {
        id: "robot",
        model: LOLYA,
        kind: Kind::Qwen {
            file: LOLYA_FILE,
            speaker: "lolya",
            robot: true,
        },
    },
    Voice {
        id: "af_heart",
        model: KOKORO,
        kind: Kind::Kokoro {
            file: "model.int8.onnx",
            speaker: 3,
        },
    },
    Voice {
        id: "am_michael",
        model: KOKORO,
        kind: Kind::Kokoro {
            file: "model.int8.onnx",
            speaker: 16,
        },
    },
];

pub fn find(id: &str) -> Option<&'static Voice> {
    VOICES.iter().find(|v| v.id == id)
}
