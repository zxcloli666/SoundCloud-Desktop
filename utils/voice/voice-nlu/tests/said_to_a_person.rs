use voice_nlu::{Intent, Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

#[test]
fn an_order_said_to_a_person_by_name_does_nothing() {
    for text in [
        "john stop it right now",
        "john next",
        "hey john stop it",
        "john can you stop the music",
        "ok john pause",
        "andy turn it down a bit",
        "john play queen",
        "john put on some queen",
        "саша выключи музыку",
        "маш сделай потише",
        "дим следующий трек",
        "лена громче",
        "саша включи кино",
        "дим поставь цоя",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn an_order_said_to_the_assistant_is_carried_out() {
    for (text, want) in [
        ("loli stop", "stop"),
        ("лоля выключи музыку", "stop"),
        ("лоля включи кино", "play"),
        ("next", "next"),
        ("коля подай ключи следующая песня", "next"),
    ] {
        assert_eq!(steps(text), [want], "{text}");
    }
}

#[test]
fn a_first_name_inside_a_request_for_music_is_part_of_the_name() {
    for (text, name) in [
        ("play john lennon", "john lennon"),
        ("play elton john", "elton john"),
        ("play michael jackson", "michael jackson"),
        ("включи сашу", "сашу"),
        ("поставь диму билана", "диму билана"),
    ] {
        let said = &read(text)[0];
        assert_eq!(said.intent, Intent::Play, "{text}");
        assert!(said.queries.iter().any(|q| q.text == name), "{text}");
    }
    let bare = &read("john lennon imagine")[0];
    assert!(bare.queries.iter().any(|q| q.text == "john lennon imagine"));
}
