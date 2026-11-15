use voice_qwen::Sampling;

use crate::qwen::{CALM, USUAL};

pub const DEFAULT: &str = "loli";
pub const MORIARTY: &str = "moriarty";
pub const KOKORO: &str = "kokoro-multi-lang-v1_0";
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
        manner: Sampling,
    },
}

pub struct Voice {
    pub id: &'static str,
    pub model: &'static str,
    pub kind: Kind,
}

const VOICES: [Voice; 4] = [
    Voice {
        id: DEFAULT,
        model: "qwen-loli",
        kind: Kind::Qwen {
            file: "qwen-talker-1.7b-loli-Q4_K_M.gguf",
            speaker: "loli",
            manner: CALM,
        },
    },
    Voice {
        id: MORIARTY,
        model: "qwen-moriarty",
        kind: Kind::Qwen {
            file: "qwen-talker-1.7b-moriarty-Q4_K_M.gguf",
            speaker: "moriarty",
            manner: USUAL,
        },
    },
    Voice {
        id: "af_heart",
        model: KOKORO,
        kind: Kind::Kokoro {
            file: "model.onnx",
            speaker: 3,
        },
    },
    Voice {
        id: "am_michael",
        model: KOKORO,
        kind: Kind::Kokoro {
            file: "model.onnx",
            speaker: 16,
        },
    },
];

pub fn find(id: &str) -> &'static Voice {
    VOICES.iter().find(|v| v.id == id).unwrap_or(&VOICES[0])
}

impl Voice {
    pub fn streams(&self) -> bool {
        matches!(self.kind, Kind::Qwen { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unknown_voice_is_the_default_one() {
        assert_eq!(find("moriarty").id, "moriarty");
        assert_eq!(find("lolya").id, DEFAULT);
        assert_eq!(find("").id, DEFAULT);
        assert_eq!(crate::Config::default().speak.voice, DEFAULT);
    }

    #[test]
    fn each_character_reads_in_its_own_manner() {
        let manner = |id| match find(id).kind {
            Kind::Qwen { manner, .. } => Some(manner),
            Kind::Kokoro { .. } => None,
        };
        assert_eq!(manner(DEFAULT), Some(CALM));
        assert_eq!(manner(MORIARTY), Some(USUAL));
    }
}
