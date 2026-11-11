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
