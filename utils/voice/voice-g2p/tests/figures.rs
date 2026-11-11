use voice_g2p::figures::{Tongue, in_words};

fn check(usual: Tongue, cases: &[(&str, &str)]) {
    let mut bad = Vec::new();
    for (input, want) in cases {
        let got = in_words(input, usual);
        if got != *want {
            bad.push(format!("{input:?}\n  want {want:?}\n  got  {got:?}"));
        }
    }
    assert!(bad.is_empty(), "\n{}", bad.join("\n"));
}

#[test]
fn russian_numbers_follow_the_words_around_them() {
    check(
        Tongue::Ru,
        &[
            ("Громкость 50", "Громкость пятьдесят"),
            ("Громче, 60", "Громче, шестьдесят"),
            ("Нашла 3 трека.", "Нашла три трека."),
            ("Вперёд на 30 секунд", "Вперёд на тридцать секунд"),
            ("Назад на 1 секунду", "Назад на одну секунду"),
            (
                "Перематываю на 2 минуты 5 секунд",
                "Перематываю на две минуты пять секунд",
            ),
            ("Трек 3 из 10", "Трек три из десяти"),
            ("3-й трек", "третий трек"),
            ("Хиты 90-х", "Хиты девяностых"),
            ("1 000 000 прослушиваний", "один миллион прослушиваний"),
            ("Сейчас -5 градусов", "Сейчас минус пять градусов"),
        ],
    );
}

#[test]
fn russian_units_years_times_and_dates_are_said_in_full() {
    check(
        Tongue::Ru,
        &[
            ("Громкость 50%", "Громкость пятьдесят процентов"),
            ("Осталось 2 %", "Осталось два процента"),
            ("3,5 км", "три целых пять десятых километра"),
            ("Частота 44 кГц", "Частота сорок четыре килогерца"),
            (
                "Это вышло в 2024 году.",
                "Это вышло в две тысячи двадцать четвёртом году.",
            ),
            (
                "Альбом 1999 года",
                "Альбом тысяча девятьсот девяносто девятого года",
            ),
            ("Встретимся в 17:45", "Встретимся в семнадцать сорок пять"),
            (
                "Вышел 12.03.2024",
                "Вышел двенадцатое марта две тысячи двадцать четвёртого года",
            ),
        ],
    );
}

#[test]
fn english_numbers_are_said_in_english() {
    check(
        Tongue::En,
        &[
            ("Volume 50", "Volume fifty"),
            ("Louder, 60", "Louder, sixty"),
            ("Forward 30 seconds", "Forward thirty seconds"),
            ("Jumping to 1:30", "Jumping to one thirty"),
            ("Volume 50%", "Volume fifty percent"),
            (
                "The 21st song of 1999",
                "The twenty-first song of nineteen ninety-nine",
            ),
            ("1,000 plays", "one thousand plays"),
            ("2.5 hours", "two point five hours"),
            ("It is -5 outside", "It is minus five outside"),
        ],
    );
}

#[test]
fn a_number_is_said_in_the_language_of_the_words_next_to_it() {
    check(
        Tongue::Ru,
        &[
            ("Включаю 50 Cent", "Включаю fifty Cent"),
            (
                "Включаю 21 Savage и 3 трека",
                "Включаю twenty-one Savage и три трека",
            ),
            (
                "Включаю плейлист Lo-Fi Beats 2024",
                "Включаю плейлист Lo-Fi Beats twenty twenty-four",
            ),
            (
                "Сейчас играет Taylor Swift — 1989",
                "Сейчас играет Taylor Swift — nineteen eighty-nine",
            ),
            ("Включаю blink-182", "Включаю blink-one hundred eighty-two"),
            ("Включаю Би-2", "Включаю Би-два"),
            ("Включаю 25/17", "Включаю двадцать пять/семнадцать"),
            ("Включаю The 1975", "Включаю The nineteen seventy-five"),
            ("Темп 120 BPM", "Темп one hundred twenty BPM"),
            ("50", "пятьдесят"),
        ],
    );
    check(
        Tongue::En,
        &[
            ("50", "fifty"),
            ("Playing Кино 3 раза", "Playing Кино три раза"),
        ],
    );
}

#[test]
fn the_rest_of_the_text_stays_as_written() {
    check(
        Tongue::Ru,
        &[
            ("Включаю Скриптонит — Цепи", "Включаю Скриптонит — Цепи"),
            (
                "Что-нибудь из The Weeknd, AC/DC?",
                "Что-нибудь из The Weeknd, AC/DC?",
            ),
            (
                "Не нашлось «Imagine Dragons»!",
                "Не нашлось «Imagine Dragons»!",
            ),
        ],
    );
}

#[test]
fn digits_inside_a_latin_name_are_english_words_of_their_own() {
    check(
        Tongue::Ru,
        &[
            ("Включаю 2Pac", "Включаю two Pac"),
            ("Включаю Sum41", "Включаю Sum forty-one"),
            ("Включаю U2", "Включаю U two"),
            ("Формат MP3 или 4K", "Формат MP three или four K"),
            ("Включаю R2D2", "Включаю R two D two"),
            ("Хиты 80s и 1990s", "Хиты eighties и nineteen nineties"),
            ("Агент 007", "Агент ноль ноль семь"),
        ],
    );
}

#[test]
fn digits_inside_a_russian_name_versions_and_english_dates_stay_digits() {
    check(
        Tongue::Ru,
        &[
            ("Включаю 2Маши", "Включаю 2Маши"),
            ("Включаю Тату2", "Включаю Тату2"),
            ("Released 12.03.2024", "Released 12.03.2024"),
            ("Версия 1.2.3 вышла", "Версия 1.2.3 вышла"),
            ("Адрес 192.168.0.1", "Адрес 192.168.0.1"),
        ],
    );
}
