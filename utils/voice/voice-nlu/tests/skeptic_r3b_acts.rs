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

#[test]
fn silence_said_with_a_describing_word_describes_the_room() {
    stays_silent(&[
        "ну и тишина тут",
        "тут такая тишина",
        "какая тишина",
        "тишина здесь",
        "в комнате тишина",
    ]);
    acts(&[
        ("тишина", "pause"),
        ("тишина пожалуйста", "pause"),
        ("тишину", "pause"),
        ("давай тишину", "pause"),
    ]);
}

#[test]
fn listening_planned_for_later_is_talk() {
    stays_silent(&[
        "вечером наверное послушаем земфиру",
        "завтра послушаем кино",
        "вечером послушаю земфиру",
        "наверное послушаем потом",
    ]);
    acts(&[
        ("послушаем земфиру", "play"),
        ("давай послушаем земфиру", "play"),
        ("может послушаем земфиру", "play"),
    ]);
}

#[test]
fn a_loudness_adjective_describes_a_noun_and_is_not_the_volume() {
    stays_silent(&[
        "мы же договорились без громкой музыки после десяти",
        "громкая музыка мешает спать",
        "громкий звук пугает кошку",
    ]);
    acts(&[
        ("громкость 50", "volume_set"),
        ("громкость на максимум", "volume_set"),
        ("сделай громкость 7", "volume_set"),
        ("звук громче", "volume_up"),
    ]);
}

#[test]
fn a_mute_verb_with_an_object_that_is_not_the_music_is_about_something_else() {
    stays_silent(&["заглуши мотор", "заглуши двигатель", "заглуши машину"]);
    acts(&[
        ("заглуши", "mute"),
        ("заглуши музыку", "mute"),
        ("заглуши звук", "mute"),
        ("заглуши эту песню", "mute"),
        ("заглуши его", "mute"),
        ("заглуши на минуту", "mute"),
    ]);
}

#[test]
fn a_direction_word_after_not_is_denied() {
    stays_silent(&["не смотри назад", "не назад", "не вперед", "не дальше"]);
    acts(&[
        ("назад", "previous"),
        ("не назад а вперед", "next"),
        ("перемотай назад", "seek_backward"),
    ]);
}
