use voice_nlu::{Names, parse};

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

#[test]
fn a_whole_command_word_said_again_and_again_is_said_once() {
    acts(&[
        ("громче громче громче", "volume_up"),
        ("погромче погромче погромче", "volume_up"),
        ("тише тише тише", "volume_down"),
        ("следующий следующий следующий", "next"),
        ("следующий следующий ну следующий же", "next"),
        ("стоп ну стоп стоп", "stop"),
        ("пауза пауза пауза", "pause"),
    ]);
    stays_silent(&[
        "давай давай давай",
        "люби люби люби",
        "вперед вперед вперед",
        "дальше дальше дальше будет только хуже",
        "стоп стоп стоп не говори ничего",
        "тише тише тише дети",
    ]);
}

#[test]
fn a_thing_named_after_a_volume_step_with_the_noise_it_makes_is_the_reason() {
    acts(&[
        ("сделай громче чайник кипит", "volume_up"),
        ("сделай громче чайник свистит", "volume_up"),
        ("громче чайник кипит", "volume_up"),
        ("сделай тише телефон звонит", "volume_down"),
    ]);
    stays_silent(&[
        "сделай громче чайник",
        "сделай громче будильник",
        "сделай тише телевизор орет",
        "выключи чайник кипит",
    ]);
}

#[test]
fn not_that_opens_a_polite_request_does_not_deny_it() {
    acts(&[
        (
            "извини что отвлекаю но не мог бы ты поставить на паузу",
            "pause",
        ),
        ("но не мог бы ты сделать погромче", "volume_up"),
        ("извини но не могла бы ты включить кино", "play"),
    ]);
    stays_silent(&[
        "извини что отвлекаю но не мог бы ты выключить свет",
        "извини но не могла бы ты закрыть окно",
        "не мог бы ты не включать музыку",
        "включи кино но не мог бы ты не включать его",
    ]);
}

#[test]
fn an_order_passed_on_to_another_person_is_said_about_them() {
    stays_silent(&[
        "попроси его сделать потише",
        "попроси папу сделать потише",
        "можешь попросить его выключить музыку",
        "извини но не мог бы ты попросить его сделать потише",
    ]);
    acts(&[
        ("можно попросить тебя сделать потише", "volume_down"),
        ("можно попросить сделать потише", "volume_down"),
        ("можно попросить погромче", "volume_up"),
        ("можно попросить поставить на паузу", "pause"),
    ]);
}

#[test]
fn not_wanting_this_one_and_naming_another_asks_for_the_next() {
    acts(&[
        ("не хочу эту пусть другая будет", "next"),
        ("не хочу эту давай другую", "next"),
        ("не хочу эту хочу другую", "next"),
        ("не хочу эту песню давай другую", "next"),
    ]);
    stays_silent(&[
        "не хочу эту куртку пусть другая будет",
        "не хочу эту машину давай другую",
        "не хочу эту выключать",
        "не хочу другую",
    ]);
}

#[test]
fn a_name_glued_to_a_command_or_started_twice_is_still_the_name() {
    acts(&[
        ("лоляпауза", "pause"),
        ("лоляпотише", "volume_down"),
        ("лолюпауза", "pause"),
        ("лолявключи баста", "play"),
        ("ло лоля пауза", "pause"),
        ("lo loli pause", "pause"),
    ]);
    stays_silent(&["лолита", "лолипоп", "ло лоля"]);
    let kept = parse("включи лолиту", &Names::new(&["Лоля"]));
    assert!(kept[0].queries.iter().any(|q| q.text == "лолиту"));
}

#[test]
fn a_rude_word_inside_a_command_only_stresses_it() {
    acts(&[
        ("нахрен следующий", "next"),
        ("тише ппц", "volume_down"),
        ("давай мля следующий трек", "next"),
        ("заебал этот трек следующий", "next"),
        ("достала эта песня следующая", "next"),
    ]);
    stays_silent(&[
        "нахрен следующий урок",
        "заебал этот сосед следующий",
        "надоел этот урок следующий",
        "ппц",
        "мля",
    ]);
}
