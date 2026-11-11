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
