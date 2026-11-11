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
