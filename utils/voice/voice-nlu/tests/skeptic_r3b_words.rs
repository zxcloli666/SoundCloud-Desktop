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
fn a_command_word_right_after_not_is_denied_and_the_one_before_it_stands() {
    stays_silent(&[
        "не громче",
        "не тише",
        "не пауза",
        "не следующий",
        "не предыдущий",
        "не стоп",
        "громче не надо",
        "не надо громче",
    ]);
    acts(&[
        ("тише не громче", "volume_down"),
        ("сделай погромче не тише", "volume_up"),
        ("назад не вперед", "previous"),
        ("пауза не стоп", "pause"),
        ("не тише а громче", "volume_up"),
        ("не не не стоп стоп стоп", "stop"),
    ]);
}

#[test]
fn a_word_that_turns_the_track_said_again_and_again_is_said_once() {
    acts(&[
        ("назад назад назад", "previous"),
        ("дальше дальше дальше", "next"),
        ("обратно обратно обратно", "previous"),
    ]);
    stays_silent(&[
        "вперед вперед вперед",
        "дальше дальше дальше будет только хуже",
    ]);
}

#[test]
fn next_said_of_a_thing_or_a_person_tells_their_place() {
    stays_silent(&[
        "эта остановка следующая",
        "этот урок следующий",
        "эта станция следующая",
        "я следующий",
        "ты следующий",
        "я пока следующий",
        "мы тоже следующие",
    ]);
    acts(&[
        ("следующий трек", "next"),
        ("следующая песня", "next"),
        ("следующий", "next"),
        ("следующая", "next"),
        ("давай следующий", "next"),
        ("следующую давай", "next"),
        ("я хочу следующий", "next"),
        ("я следующую", "next"),
        ("эта песня следующая", "next"),
        ("заебал этот трек следующий", "next"),
        ("ты давай следующий", "next"),
    ]);
}

#[test]
fn an_order_said_right_after_calling_mom_or_dad_is_for_them() {
    stays_silent(&[
        "папа включи кино",
        "мама поставь земфиру",
        "мам включи кино",
    ]);
    acts(&[
        ("слушай включи кино", "play"),
        ("ну короче включи кино", "play"),
        ("мам лоля включи кино", "play"),
    ]);
}
