use voice_nlu::{Intent, Names, Parsed, normalize, parse};

fn words(text: &str) -> String {
    normalize(text).text
}

fn steps(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
}

fn intents(text: &str) -> Vec<Intent> {
    steps(text).iter().map(|step| step.intent).collect()
}

#[test]
fn a_swear_word_is_read_for_what_it_stands_for() {
    let heard = [
        ("сука громче сделай", "громче сделай"),
        ("блять сука пиздец включи кино", "включи кино"),
        ("бляяя ну охуеть включи кино", "включи кино"),
        ("переключи блять эту хуйню", "переключи эту херню"),
        ("выключи это говно", "выключи это херню"),
        ("нихуя не слышно", "ничего не слышно"),
        ("ни хуя не слышно", "ничего не слышно"),
        ("ни хрена не слышно", "ничего не слышно"),
        ("дохуя громко", "очень громко"),
        ("заебала эта песня", "надоела эта песня"),
        ("нахуй эту песню", "нахер эту песню"),
        ("включи сукачева", "включи сукачева"),
        ("включи хулио иглесиаса", "включи хулио иглесиаса"),
    ];
    for (text, plain) in heard {
        assert_eq!(words(text), plain, "{text}");
    }
    let asked = [
        ("переключи блять эту хуйню", Intent::Next),
        ("выключи нахуй", Intent::Stop),
        ("нахуй эту песню", Intent::Next),
        ("заебала эта песня", Intent::Next),
        ("сука громче сделай", Intent::VolumeUp),
        ("нихуя не слышно", Intent::VolumeUp),
        ("дохуя громко", Intent::VolumeDown),
        ("ёб твою мать выключи", Intent::Stop),
    ];
    for (text, intent) in asked {
        assert_eq!(intents(text), [intent], "{text}");
    }
}

#[test]
fn a_word_said_again_around_an_interjection_is_said_once() {
    let cases = [
        ("следующую сука следующую", Intent::Next),
        ("дальше блять дальше", Intent::Next),
        ("следующую ну следующую", Intent::Next),
        ("громче э громче", Intent::VolumeUp),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    assert_eq!(words("следующую сука следующую"), "следующую");
}
