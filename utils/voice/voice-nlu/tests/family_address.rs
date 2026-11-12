use voice_nlu::{Intent, Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
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

fn searches(rows: &[(&str, &str)]) {
    for (text, name) in rows {
        let heard = parse(text, &Names::new(&["Лоля"]));
        assert_eq!(heard.len(), 1, "{text}");
        assert_eq!(heard[0].intent, Intent::Play, "{text}");
        assert!(heard[0].queries.iter().any(|q| q.text == *name), "{text}");
    }
}

#[test]
fn an_order_said_right_after_calling_a_family_member_is_for_them() {
    stays_silent(&[
        "бабуля выключи музыку",
        "дедушка сделай погромче",
        "дочка поставь на паузу",
        "ребятки выключите музыку",
        "папуль включи кино",
        "дедуля включи кино",
        "мамочка сделай потише",
        "батя пауза",
        "детки выключите музыку",
        "сынуля сделай погромче",
        "доченька выключи музыку",
    ]);
    acts(&[
        ("брат выключи музыку", "stop"),
        ("бро поставь на паузу", "pause"),
        ("сделай погромче", "volume_up"),
    ]);
}

#[test]
fn a_family_member_doing_something_is_spoken_of_and_the_order_is_for_the_listener() {
    acts(&[
        ("бабушка уснула сделай потише", "volume_down"),
        ("папа спит поставь на паузу", "pause"),
        ("дедушка пришел поставь на паузу", "pause"),
        ("мама звонит стоп", "stop"),
        ("дети пришли пауза", "pause"),
        ("дедушка плохо слышит сделай погромче", "volume_up"),
    ]);
    stays_silent(&[
        "мама говорит пауза",
        "мама кричит пауза",
        "мама я сейчас приду сделай потише",
        "дети идите сюда сделай потише",
    ]);
}

#[test]
fn words_about_a_family_member_after_a_waver_leave_the_command() {
    for (text, name) in [
        ("включи кино ой бабушка пришла", "кино"),
        ("поставь земфиру ой мама", "земфиру"),
        ("включи кино хотя бабушка спит", "кино"),
    ] {
        let heard = parse(text, &Names::new(&["Лоля"]));
        assert_eq!(heard.len(), 1, "{text}");
        assert_eq!(heard[0].intent, Intent::Play, "{text}");
        assert_eq!(heard[0].queries[0].text, name, "{text}");
    }
    acts(&[("пауза ой дети пришли", "pause")]);
    stays_silent(&["стоп нет дети пришли"]);
}

#[test]
fn a_family_word_inside_a_name_after_a_play_verb_stays_in_the_name() {
    searches(&[
        ("включи мама люба", "мама люба"),
        ("включи папа роуч", "папа роуч"),
        ("поставь мама я гей", "мама я гей"),
        ("включи дед максим", "дед максим"),
        ("поставь дед максим", "дед максим"),
        ("включи хаски мама", "хаски мама"),
    ]);
}

#[test]
fn going_on_to_tell_what_a_family_member_did_is_a_story() {
    stays_silent(&[
        "дальше мама пошла домой",
        "дальше бабушка пошла спать",
        "назад дедушка пришел",
    ]);
    acts(&[("дальше", "next"), ("давай дальше", "next")]);
}
