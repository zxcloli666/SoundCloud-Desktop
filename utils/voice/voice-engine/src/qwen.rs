use voice_qwen::Request;

const FRAMES_PER_SECOND: f32 = 12.5;
const CHARS_PER_SECOND: f32 = 11.0;
const LANG: &str = "auto";
const SEED: i64 = 1;
const TRIAL: &str = "Проверяю, как быстро получается говорить на этом компьютере.";

pub fn seconds(text: &str) -> f32 {
    0.3 + text.chars().count() as f32 / CHARS_PER_SECOND
}

pub fn request<'a>(text: &'a str, speaker: &'a str) -> Request<'a> {
    Request {
        text,
        speaker,
        lang: LANG,
        seed: SEED,
        max_tokens: max_tokens(text),
    }
}

pub fn trial(speaker: &str) -> Request<'_> {
    request(TRIAL, speaker)
}

fn max_tokens(text: &str) -> u32 {
    (seconds(text) * FRAMES_PER_SECOND * 2.5) as u32 + 40
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use voice_qwen::STALL;

    use super::*;
    use crate::Timing;

    #[test]
    fn a_reply_is_waited_for_longer_than_the_engine_may_hang() {
        assert!(Timing::default().synth >= STALL + Duration::from_secs(10));
    }

    #[test]
    fn longer_text_gets_more_room() {
        assert!(seconds("Включаю Скриптонита.") > 1.5);
        assert!(seconds("Включаю Скриптонита.") < 3.0);
        assert!(max_tokens("Да.") >= 50);
        assert!(max_tokens(&"слово ".repeat(40)) > max_tokens("Включаю Скриптонита.") * 3);
    }
}
