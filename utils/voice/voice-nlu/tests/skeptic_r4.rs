use voice_nlu::{Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Лоля"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

fn names(text: &str) -> Vec<String> {
    let steps = read(text);
    steps[0].queries.iter().map(|q| q.text.clone()).collect()
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
fn an_announcement_that_something_goes_on_is_not_resume() {
    stays_silent(&["продолжение следует", "продолжение будет завтра"]);
    acts(&[("продолжение", "resume"), ("давай продолжение", "resume")]);
}

#[test]
fn the_sound_turned_off_in_a_story_about_someone_is_not_mute() {
    stays_silent(&["он сказал выключи звук и ушёл", "он сказал выключи звук"]);
    acts(&[
        ("выключи звук", "mute"),
        ("звук выключи", "mute"),
        ("выруби звук полностью", "mute"),
        ("выключи звук на минуту", "mute"),
        ("выруби звук на хрен", "mute"),
    ]);
}

#[test]
fn a_complaint_that_it_is_loud_or_quiet_changes_the_volume() {
    acts(&[
        ("уши болят от этой громкости", "volume_down"),
        ("какого хрена так громко", "volume_down"),
        ("ты чего так тихо играешь", "volume_up"),
    ]);
    stays_silent(&["почему в комнате так тихо", "уши болят"]);
}

#[test]
fn someone_asleep_is_a_reason_to_be_quieter() {
    acts(&[
        ("ребёнок спит потише пожалуйста", "volume_down"),
        ("дети спят сделай потише", "volume_down"),
        ("малой уснул пауза", "pause"),
    ]);
    stays_silent(&["ребёнок спит громче", "ребёнок спит", "папа сказал потише"]);
}

#[test]
fn a_complaint_about_what_plays_skips_it() {
    acts(&[
        ("это уже слушали сто раз", "next"),
        ("ну и дрянь играет", "next"),
        ("давай-ка послухаем другую", "next"),
        ("skip this one", "next"),
        ("что за дрянь играет", "now_playing"),
    ]);
}

#[test]
fn local_and_slang_words_around_a_command_are_read() {
    acts(&[
        ("ну дак поставь на паузу", "pause"),
        ("замути земфиру", "play"),
        ("пусть играет король и шут", "play"),
    ]);
    stays_silent(&["пусть играет"]);
    assert_eq!(names("пусть играет король и шут")[0], "король и шут");
    assert_eq!(names("замути земфиру")[0], "земфиру");
}

#[test]
fn something_of_a_mood_in_any_form_is_the_wave() {
    acts(&[
        ("что-то новенькое", "play_wave"),
        ("включи чего-нибудь спокойного", "play_wave"),
        ("включи самое популярное", "play_wave"),
        ("включи популярное", "play_wave"),
    ]);
    stays_silent(&["что-то грустное"]);
}

#[test]
fn a_descriptor_before_an_artist_leaves_the_artist() {
    for (text, artist) in [
        ("что-нибудь старенькое от кино", "кино"),
        ("включи что-нибудь старенькое от кино", "кино"),
        ("самое популярное у земфиры", "земфиры"),
        ("включи самое популярное у земфиры", "земфиры"),
    ] {
        assert_eq!(names(text)[0], artist, "{text}");
    }
}

#[test]
fn the_volume_given_back_is_the_sound_turned_on() {
    acts(&[
        ("верни громкость", "unmute"),
        ("верни громкость как было", "unmute"),
        ("верни звук", "unmute"),
    ]);
}

#[test]
fn another_name_asked_for_after_a_no_is_the_one_to_play() {
    let said = &read("не надо басту давай кино")[0];
    assert!(said.bare, "{said:?}");
    assert_eq!(said.queries[0].text, "кино");
    stays_silent(&["не хочу эту машину давай другую"]);
}

#[test]
fn a_name_and_a_command_after_then_are_both_kept() {
    let text = "включи сплин а потом нервы и потише";
    assert_eq!(steps(text), ["play", "queue_add", "volume_down"]);
    assert_eq!(read(text)[1].queries[0].text, "нервы");
    let text = "включи сплин а потом король и шут";
    assert_eq!(steps(text), ["play", "queue_add"]);
    assert_eq!(read(text)[1].queries[0].text, "король и шут");
}

#[test]
fn the_end_of_the_queue_is_still_the_queue() {
    let text = "добавь в конец очереди ну эту сансару";
    assert_eq!(steps(text), ["queue_add"]);
    assert!(names(text).iter().any(|name| name == "сансару"), "{text}");
}
