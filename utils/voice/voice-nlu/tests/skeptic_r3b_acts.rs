use voice_nlu::{Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::new(&["Лоля"]))
        .iter()
        .map(|p| p.intent.name())
        .collect()
}

fn stays_silent(phrases: &[&str]) {
    for text in phrases {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

fn acts(rows: &[(&str, &str)]) {
    for (text, want) in rows {
        assert_eq!(steps(text), [*want], "{text}");
    }
}

#[test]
fn a_phrase_that_says_it_is_not_for_the_listener_is_talk() {
    stays_silent(&[
        "Лоля это не тебе я с мамой разговариваю",
        "это не тебе",
        "я не с тобой говорю",
        "не тебе говорю",
        "это я не вам",
        "не тебя спрашиваю",
    ]);
    acts(&[
        ("это не то", "next"),
        ("не это", "next"),
        ("Лоля следующий", "next"),
    ]);
}

#[test]
fn music_named_after_about_is_the_topic_of_talk() {
    stays_silent(&[
        "я тебе не про музыку",
        "я про музыку",
        "это не про музыку",
        "мы про громкость говорили",
        "я про паузу спрашивала",
    ]);
    acts(&[
        ("музыку", "play_wave"),
        ("давай музыку", "play_wave"),
        ("включи песню про любовь", "play"),
        ("сделай потише я про громкость", "volume_down"),
    ]);
}
