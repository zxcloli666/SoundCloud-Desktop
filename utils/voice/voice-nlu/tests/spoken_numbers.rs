use voice_nlu::{Names, normalize, parse};

fn words(text: &str) -> String {
    normalize(text).text
}

fn steps(text: &str) -> String {
    parse(text, &Names::default())
        .iter()
        .map(|p| match p.number {
            Some(n) => format!("{} {n}", p.intent.name()),
            None => p.intent.name().to_string(),
        })
        .collect::<Vec<_>>()
        .join(" + ")
}

#[test]
fn a_number_word_with_a_swallowed_syllable_is_the_same_number() {
    for (text, want) in [
        ("в перед на трицать сек", "seek_forward 30"),
        ("назад на двацать секунд", "seek_backward 20"),
        ("отмотай пятнацать секунд", "seek_backward 15"),
        ("перемотай вперед на дватцать секунд", "seek_forward 20"),
        ("громкость одинадцать", "volume_set 11"),
        ("громкость на семсят", "volume_set 70"),
        ("громкость пятьсят процентов", "volume_set 50"),
        ("громкость восемьсят пять", "volume_set 85"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    assert_eq!(words("тыща девятьсот"), "1900");
    assert_eq!(words("бряцать и висят"), "бряцать и висят");
}

#[test]
fn a_number_said_in_words_and_finished_in_digits_is_one_number() {
    for (text, want) in [
        ("громкость на тридцать 5", "volume_set 35"),
        ("громкость 20 пять процентов", "volume_set 25"),
        ("сделай громкость сорок 2", "volume_set 42"),
        ("вперед на сорок 5 секунд", "seek_forward 45"),
        ("назад на сто 20 секунд", "seek_backward 120"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    assert_eq!(words("двадцать 1 pilots"), "21 pilots");
    assert_eq!(words("2 тысячи"), "2000");
    for apart in ["25 17", "1 30", "20 5", "три 6", "десять 5", "сорок 05"] {
        let kept = words(apart).split(' ').count();
        assert_eq!(kept, 2, "{apart}");
    }
}

#[test]
fn an_ordinal_before_a_time_unit_is_that_second_or_minute() {
    for (text, want) in [
        ("включи с сорок пятой секунды", "seek_to 45"),
        ("перемотай на сорок седьмую секунду", "seek_to 47"),
        ("перейди на двадцать первую секунду", "seek_to 21"),
        ("включи с пятнадцатой секунды", "seek_to 15"),
        ("поставь на сто двадцатую секунду", "seek_to 120"),
        ("перемотай на четвертую минуту", "seek_to 240"),
        ("включи с 45-й секунды", "seek_to 45"),
        ("перемотай на 30-ю секунду", "seek_to 30"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    for name in ["шестой лесничий", "седьмой лепесток", "восьмую милю"]
    {
        assert_eq!(words(name), name);
    }
}

#[test]
fn a_fond_name_for_a_round_amount_is_that_amount() {
    for (text, want) in [
        ("громкость на соточку", "volume_set 100"),
        ("звук на полтосик", "volume_set 50"),
        ("сделай громкость двадцаточку", "volume_set 20"),
        ("вперед на тридцаточку", "seek_forward 30"),
        ("назад на пятнашку", "seek_backward 15"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
}

#[test]
fn a_half_heard_apart_from_its_word_is_the_same_half() {
    for (text, want) in [
        ("назад на пол минуты", "seek_backward 30"),
        ("вперед на пол минутки", "seek_forward 30"),
        ("отмотай пол минуты", "seek_backward 30"),
        ("перемотай на пол торы минуты назад", "seek_backward 90"),
        ("вперед на пол тора минуты", "seek_forward 90"),
        ("громкость на пол", "volume_set 50"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
}

#[test]
fn two_numbers_after_a_preposition_are_minutes_and_seconds() {
    for (text, want) in [
        ("перемотай на 1 30", "seek_to 90"),
        ("мотни на две тридцать", "seek_to 150"),
        ("перейди на три ноль пять", "seek_to 185"),
        ("поставь на 2 15", "seek_to 135"),
        ("перемотай к десять двадцать", "seek_to 620"),
        ("вперед на 1 30", "seek_forward 90"),
        ("назад на одну пятнадцать", "seek_backward 75"),
        ("перемотай на 10 20 секунд", "seek_forward 20"),
        ("перемотай на 1 90", "seek_forward 90"),
        ("назад 30", "seek_backward 30"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    for name in ["включи 25 17", "поставь 25 17"] {
        assert_eq!(steps(name), "play", "{name}");
    }
}

#[test]
fn a_time_counted_from_the_start_or_played_from_is_a_position() {
    for (text, want) in [
        (
            "перемотай на две минуты пять секунд от начала",
            "seek_to 125",
        ),
        ("перемотай на 30 секунд с начала", "seek_to 30"),
        ("промотай на минуту от начала трека", "seek_to 60"),
        ("перемотай на 30 от начала", "seek_to 30"),
        ("перемотай на минуту сначала", "seek_to 60"),
        ("включи с 45 секунды", "seek_to 45"),
        ("включи с двух минут", "seek_to 120"),
        ("включи с минуты тридцать", "seek_to 90"),
        ("играй с 2:30", "seek_to 150"),
        ("перемотай на две минуты", "seek_forward 120"),
        ("перемотай на 30 секунд", "seek_forward 30"),
        ("назад на 10 секунд", "seek_backward 10"),
        ("перемотай в начало", "seek_to 0"),
        ("с минуты на минуту", "none"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    for name in ["включи 5 минут сначала", "включи 30 секунд от начала"]
    {
        assert_eq!(steps(name), "play", "{name}");
    }
}

#[test]
fn a_hedge_beside_an_amount_leaves_the_command_as_it_is() {
    for (text, want) in [
        ("пере мотай секунд на двадцать примерно", "seek_forward 20"),
        ("перемотай примерно на минуту вперед", "seek_forward 60"),
        ("перемотай где-то на минуту назад", "seek_backward 60"),
        ("назад секунд на десять приблизительно", "seek_backward 10"),
        ("вперед около минуты", "seek_forward 60"),
        ("погромче примерно на десять", "volume_up 10"),
        ("потише где-то на двадцать", "volume_down 20"),
        ("громкость примерно тридцать", "volume_set 30"),
        ("где начало", "none"),
        ("примерно", "none"),
        ("перемотай примерно", "none"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
}

#[test]
fn a_length_of_time_after_a_pause_or_a_volume_step_is_not_a_seek() {
    for (text, want) in [
        ("паузни на секунду", "pause"),
        ("пауза на секундочку", "pause"),
        ("поставь на паузу на минутку", "pause"),
        ("пауза на 5 минут", "pause"),
        ("пауза минут на пять", "pause"),
        ("тормозни на пару секунд", "pause"),
        ("на минуту пауза", "pause"),
        ("постой на минутку", "pause"),
        ("подожди на пару секунд", "pause"),
        ("стоп на минутку", "stop"),
        ("останови музыку на минуту", "stop"),
        ("потише на минуту", "volume_down"),
        ("сделай потише на 5 минут", "volume_down"),
        ("убавь звук на минутку", "volume_down"),
        ("громче на 20 на минуту", "volume_up 20"),
        ("убавь на 10 на пару минут", "volume_down 10"),
        ("выключи звук на минуту", "mute"),
        ("на секунду", "none"),
        ("на секундочку", "none"),
        ("на минутку", "none"),
        ("на одну секундочку", "none"),
        ("на одну минуту", "none"),
        ("можно тебя на минутку", "none"),
        ("пауза на минуту тридцать", "pause"),
        ("пауза на 1:30", "pause"),
        ("стоп через 5 минут", "none"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
    for (text, want) in [
        ("пауза назад на 10 секунд", "pause + seek_backward 10"),
        (
            "пауза и перемотай на минуту назад",
            "pause + seek_backward 60",
        ),
        ("потише на 10", "volume_down 10"),
        ("на минуту тридцать", "seek_to 90"),
        ("на одну минуту тридцать секунд", "seek_to 90"),
        ("на две минуты", "seek_to 120"),
        ("на полминуты", "seek_to 30"),
        ("вперед на минутку", "seek_forward 60"),
        ("секундочку", "pause"),
    ] {
        assert_eq!(steps(text), want, "{text}");
    }
}
