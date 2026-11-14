use voice_nlu::{Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Лоля"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
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
fn a_question_about_a_command_word_is_not_the_command() {
    stays_silent(&[
        "что значит слово стоп",
        "что значит стоп",
        "что такое стоп",
        "слово стоп",
        "скажи слово пауза",
        "что означает слово пауза",
    ]);
    acts(&[
        ("что это такое выключи", "stop"),
        ("ну что значит включи кино", "play"),
    ]);
}

#[test]
fn someone_or_something_noticed_after_a_command_leaves_the_command() {
    acts(&[
        ("стоп кто-то стучится", "stop"),
        ("пауза кто-то звонит", "pause"),
        ("стоп что-то горит", "stop"),
        ("тише что-то слышно", "volume_down"),
        ("пауза где-то звонит телефон", "pause"),
        ("дальше что-то другое", "next"),
    ]);
    stays_silent(&["стоп кто там"]);
}

#[test]
fn quieter_or_louder_than_it_is_changes_the_volume() {
    acts(&[
        ("сделай чуть тише чем сейчас", "volume_down"),
        ("громче чем было", "volume_up"),
        ("тише чем раньше", "volume_down"),
    ]);
    stays_silent(&["тише чем он"]);
}

#[test]
fn a_radio_heard_too_loud_is_not_the_player() {
    stays_silent(&[
        "в машине слишком громко играет радио",
        "радио слишком громко",
        "радио потише",
    ]);
    acts(&[
        ("включи радио", "play_wave"),
        ("включи радио погромче", "play"),
        ("слишком громко", "volume_down"),
    ]);
}

#[test]
fn a_ring_said_beside_pause_is_pause() {
    acts(&[
        ("пауза звонят", "pause"),
        ("звонят пауза", "pause"),
        ("в дверь звонят пауза", "pause"),
        ("телефон звонит", "pause"),
    ]);
}

#[test]
fn words_of_recalling_before_a_name_are_dropped() {
    for text in [
        "включи ну как там сансару",
        "включи эту как там её сансару",
        "включи мне вот это ну как там сансару",
    ] {
        let said = &read(text)[0];
        assert_eq!(said.intent.name(), "play", "{text}");
        assert!(said.queries.iter().any(|q| q.text == "сансару"), "{text}");
    }
}

#[test]
fn english_refusals_and_retold_orders_do_nothing() {
    stays_silent(&[
        "i did not say pause",
        "nobody said pause",
        "don't skip",
        "dont play drake",
        "do not play drake",
        "he told me to stop",
    ]);
    acts(&[("pause", "pause"), ("skip", "next"), ("no pause", "pause")]);
}

#[test]
fn an_english_title_with_a_refusal_in_it_is_still_asked_for() {
    for text in [
        "play dont stop believing",
        "play do not disturb",
        "play not afraid",
    ] {
        assert_eq!(steps(text), ["play"], "{text}");
    }
    let said = &read("dont play drake play eminem")[0];
    assert_eq!(said.intent.name(), "play");
    assert!(said.queries.iter().any(|q| q.text == "eminem"));
}

#[test]
fn an_english_second_thought_keeps_the_last_name() {
    for text in [
        "play eminem no wait rihanna",
        "play eminem i mean rihanna",
        "play eminem wait no rihanna",
    ] {
        let said = &read(text)[0];
        assert_eq!(said.intent.name(), "play", "{text}");
        assert!(said.queries.iter().any(|q| q.text == "rihanna"), "{text}");
        assert!(
            said.queries.iter().all(|q| !q.text.contains("eminem")),
            "{text}"
        );
    }
}

#[test]
fn the_previous_or_next_one_in_english_switches_the_track() {
    acts(&[
        ("go back to the previous song", "previous"),
        ("play the previous one", "previous"),
        ("the next one", "next"),
        ("skip to the next one", "next"),
    ]);
}

#[test]
fn who_is_this_asks_what_plays() {
    acts(&[
        ("who is this", "now_playing"),
        ("who's that", "now_playing"),
    ]);
}
