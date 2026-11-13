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
fn an_ordinal_that_describes_the_word_after_it_is_not_a_command() {
    stays_silent(&[
        "в следующем выпуске мы расскажем",
        "на предыдущем треке было лучше",
    ]);
    acts(&[
        ("к следующей", "next"),
        ("перейди к следующему треку", "next"),
        ("следующую блин", "next"),
    ]);
}

#[test]
fn a_radio_asked_to_be_louder_is_not_the_player() {
    stays_silent(&[
        "сделай радио погромче",
        "радио погромче",
        "сделай радио потише",
        "водитель сделайте погромче радио",
    ]);
    acts(&[("радио", "play_wave"), ("включи радио", "play_wave")]);
    let turned_on = &read("включи радио погромче")[0].split[0];
    let split: Vec<&str> = turned_on.iter().map(|p| p.intent.name()).collect();
    assert_eq!(split, ["play_wave", "volume_up"]);
}

#[test]
fn mute_named_after_a_verb_is_turned_on_or_off() {
    acts(&[
        ("включи мьют", "mute"),
        ("поставь mute", "mute"),
        ("выключи мьют", "unmute"),
        ("убери mute", "unmute"),
        ("мьют", "mute"),
    ]);
}

#[test]
fn a_command_said_over_and_over_is_one_command() {
    acts(&[
        ("включи кино включи кино ну включи кино", "play"),
        ("включи кино включи кино", "play"),
        ("следующий трек следующий трек", "next"),
    ]);
    assert_eq!(names("включи кино включи кино ну включи кино")[0], "кино");
}

#[test]
fn an_oath_around_a_command_is_left_out() {
    acts(&[
        ("чёрт возьми поставь паузу", "pause"),
        ("чёрт побери следующий", "next"),
        ("пауза йопта", "pause"),
    ]);
}

#[test]
fn a_sound_of_doubt_after_the_next_track_is_not_its_name() {
    acts(&[
        ("типа ну следующий трек короче", "next"),
        ("следующий трек короче", "next"),
        ("предыдущую песню ну", "previous"),
    ]);
    assert_eq!(names("включи трек короче")[0], "короче");
}

#[test]
fn asking_what_the_assistant_can_help_with_is_help() {
    acts(&[
        ("чем ты можешь помочь", "help"),
        ("чем можешь помочь", "help"),
    ]);
    stays_silent(&["чем помочь"]);
}

#[test]
fn a_wish_said_with_i_plays_what_is_wished() {
    for (text, name) in [("я хочу земфиру", "земфиру"), ("я хочу кино", "кино")]
    {
        assert_eq!(steps(text), ["play"], "{text}");
        assert_eq!(names(text)[0], name, "{text}");
    }
    stays_silent(&[
        "мы хотим земфиру",
        "она хочет земфиру",
        "я хочу чтобы ты замолчала",
        "я хотел чтобы она играла на пианино",
    ]);
}

#[test]
fn what_is_asked_to_follow_is_queued_after_what_plays() {
    let text = "включи цепи скриптонит а следом сансару басты";
    assert_eq!(steps(text), ["play", "queue_add"]);
    let queued = &read(text)[1];
    assert_eq!(queued.queries[0].text, "сансару басты");
    acts(&[("поставь следом земфиру", "queue_add")]);
}

#[test]
fn anything_of_a_mood_is_the_wave() {
    acts(&[
        ("что-нибудь весёлое", "play_wave"),
        ("что-нибудь погрустнее", "play_wave"),
        ("включи весёлую музыку", "play_wave"),
        ("включи грустную песню", "play_wave"),
    ]);
    stays_silent(&["что-то грустное"]);
}

#[test]
fn a_name_said_twice_in_a_row_is_asked_once() {
    for (text, name) in [
        ("искала искала земфира", "искала земфира"),
        ("каждый раз каждый раз монеточка", "каждый раз монеточка"),
    ] {
        let step = &read(text)[0];
        assert!(step.bare, "{text}");
        assert_eq!(step.queries[0].text, name, "{text}");
    }
    for text in [
        "ля ля ля",
        "да да",
        "привет привет",
        "искала искала",
        "shake it off shake it off",
    ] {
        let step = &read(text)[0];
        assert!(!step.bare && step.queries.is_empty(), "{text}");
    }
}
