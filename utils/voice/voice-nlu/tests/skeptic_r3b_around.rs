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
