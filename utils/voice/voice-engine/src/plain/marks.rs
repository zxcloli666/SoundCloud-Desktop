use crate::sentences::{MARKUP, pictured, unlinked};

const ACCENTS: [char; 2] = ['\u{300}', '\u{301}'];
const STRESSED: &str = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";

pub fn without(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let chars = unlinked(&chars);
    let mut out = String::with_capacity(text.len());
    for (at, c) in chars.iter().enumerate() {
        if ACCENTS.contains(c) || MARKUP.contains(c) || stress(&chars, at) {
            continue;
        }
        out.push(if pictured(*c) || *c == '_' { ' ' } else { *c });
    }
    out
}

fn stress(chars: &[char], at: usize) -> bool {
    chars[at] == '+' && chars.get(at + 1).is_some_and(|c| STRESSED.contains(*c))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stress_marks_of_the_phoneme_voices_are_dropped() {
        assert_eq!(without("Включ+аю Скрипт+онита"), "Включаю Скриптонита");
        assert_eq!(without("проце\u{301}нтов"), "процентов");
        assert_eq!(without("+эхо"), "эхо");
    }

    #[test]
    fn a_plus_that_is_not_a_stress_mark_stays() {
        assert_eq!(without("C++ и Google+"), "C++ и Google+");
        assert_eq!(without("2+2"), "2+2");
        assert_eq!(without("A+B"), "A+B");
    }

    #[test]
    fn markup_is_dropped() {
        assert_eq!(without("Включаю #1 Hit"), "Включаю 1 Hit");
        assert_eq!(without("Это **важно** и `так`"), "Это важно и так");
        assert_eq!(without("Track_01"), "Track 01");
    }

    #[test]
    fn pictures_and_links_are_not_text() {
        assert_eq!(without("Готово 🎵 включаю!"), "Готово   включаю!");
        assert_eq!(without("Вот 👍🏽"), "Вот   ");
        assert_eq!(
            without("Смотри https://example.com/a?b=1 там"),
            "Смотри  там"
        );
        assert_eq!(without("Это [тут](https://example.com)."), "Это тут.");
    }
}
