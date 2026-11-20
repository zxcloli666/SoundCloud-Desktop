mod joins;
mod marks;
mod signs;

use voice_g2p::figures::{self, Tongue};

use crate::config::Language;

pub fn text(written: &str, language: Language) -> String {
    let usual = match language {
        Language::Ru => Tongue::Ru,
        Language::En => Tongue::En,
    };
    let text = signs::named(&marks::without(written));
    let text = figures::in_words(&text, usual);
    joins::smooth(&signs::in_words(&text, usual))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(language: Language, cases: &[(&str, &str)]) {
        let mut bad = Vec::new();
        for (written, said) in cases {
            let got = text(written, language);
            if got != *said {
                bad.push(format!("{written:?}\n  want {said:?}\n  got  {got:?}"));
            }
        }
        assert!(bad.is_empty(), "\n{}", bad.join("\n"));
    }

    #[test]
    fn russian_replies_are_plain_words() {
        check(
            Language::Ru,
            &[
                (
                    "Включу что-нибудь спокойное.",
                    "Включу что нибудь спокойное.",
                ),
                (
                    "Кто-то из-за этого говорит по-русски.",
                    "Кто то из за этого говорит по русски.",
                ),
                ("Включаю Скриптонит — Цепи", "Включаю Скриптонит, Цепи."),
                (
                    "Сейчас играет AC/DC — Back in Black",
                    "Сейчас играет AC/DC, Back in Black.",
                ),
                ("Громкость 50", "Громкость пятьдесят."),
                ("Громче, 60", "Громче, шестьдесят."),
                ("Громкость 50%", "Громкость пятьдесят процентов."),
                ("Нашла 3 трека.", "Нашла три трека."),
                ("Вперёд на 30 секунд", "Вперёд на тридцать секунд."),
                (
                    "Перематываю на 1 минуту 30 секунд",
                    "Перематываю на одну минуту тридцать секунд.",
                ),
                (
                    "Это вышло в 2024 году.",
                    "Это вышло в две тысячи двадцать четвёртом году.",
                ),
                ("Трек №5", "Трек номер пять."),
                ("Работает 24/7", "Работает двадцать четыре семь."),
                ("Не нашлось «что-то»", "Не нашлось «что то»."),
                (
                    "Включаю Скриптонит (feat. Баста)",
                    "Включаю Скриптонит, feat. Баста.",
                ),
                ("Сейчас -5 градусов", "Сейчас минус пять градусов."),
                (
                    "Добавлено в очередь: Скриптонит",
                    "Добавлено в очередь: Скриптонит.",
                ),
            ],
        );
    }

    #[test]
    fn marks_that_are_not_speech_are_left_out() {
        check(
            Language::Ru,
            &[
                ("Включ+аю Скрипт+онита", "Включаю Скриптонита."),
                ("Ну... не знаю… может быть.", "Ну, не знаю, может быть."),
                ("Готово 🎵 включаю!", "Готово включаю!"),
                (
                    "Смотри на https://example.com/artist/track там всё есть.",
                    "Смотри на там всё есть.",
                ),
                ("Это C++ и Google+", "Это C плюс плюс и Google плюс."),
                ("Включаю #1 Hit", "Включаю one Hit."),
                ("Включаю Тимати & Джиган", "Включаю Тимати и Джиган."),
                ("🎵", ""),
                ("…", ""),
            ],
        );
    }

    #[test]
    fn latin_names_stay_as_written_with_their_numbers_in_english() {
        check(
            Language::Ru,
            &[
                ("Включаю The Weeknd", "Включаю The Weeknd."),
                (
                    "Включаю плейлист Lo-Fi Beats 2024",
                    "Включаю плейлист Lo Fi Beats twenty twenty four.",
                ),
                (
                    "Включаю 21 Savage, 50 Cent и blink-182",
                    "Включаю twenty one Savage, fifty Cent и blink one hundred eighty two.",
                ),
                ("Включаю Track_01 [Remix]", "Включаю Track zero one, Remix."),
                (
                    "Включаю Simon & Garfunkel (Live)",
                    "Включаю Simon and Garfunkel, Live.",
                ),
                ("Включаю 2Pac и Sum41", "Включаю two Pac и Sum forty one."),
                ("Включаю U2", "Включаю U two."),
                ("Включаю Би-2", "Включаю Би два."),
                ("Включаю 2Маши", "Включаю 2Маши."),
            ],
        );
    }

    #[test]
    fn english_replies_are_plain_words() {
        check(
            Language::En,
            &[
                ("Volume 50", "Volume fifty."),
                ("Louder, 60", "Louder, sixty."),
                ("Forward 30 seconds", "Forward thirty seconds."),
                (
                    "Jumping to 1 minute 30 seconds",
                    "Jumping to one minute thirty seconds.",
                ),
                (
                    "Playing Blinding Lights by The Weeknd",
                    "Playing Blinding Lights by The Weeknd.",
                ),
                ("I couldn't find \"Lo-Fi\"", "I couldn't find \"Lo Fi\"."),
            ],
        );
    }
}
