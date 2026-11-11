use voice_nlu::{Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::default())
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
fn a_direction_word_taken_by_the_subject_or_verb_after_it_is_talk() {
    stays_silent(&[
        "дальше я сам разберусь спасибо",
        "дальше сам разберёшься",
        "дальше я не помню как там поётся",
        "ну дальше ты сама",
        "а дальше я пойду спать",
        "назад назад отходим нас тут всех положат",
        "назад я уже не вернусь",
        "вперёд мы не пойдём",
        "обратно поедем на такси",
        "давай дальше я сам",
    ]);
    acts(&[
        ("дальше эта какая-то грустная", "next"),
        ("дальше мне эта не нравится", "next"),
        ("дальше давай", "next"),
        ("включи дальше я устала", "next"),
        ("назад верни", "previous"),
        ("назад на 10 секунд", "seek_backward"),
        ("перемотай назад я прослушал", "seek_backward"),
        ("вперёд секунд на двадцать", "seek_forward"),
    ]);
}
