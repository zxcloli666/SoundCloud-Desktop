use voice_nlu::{Names, parse};

fn heard_as_talk(text: &str) -> bool {
    parse(text, &Names::new(&["Лоля"])).iter().any(|p| p.talk)
}

#[test]
fn a_refusal_and_words_about_something_else_are_heard_as_talk() {
    for text in [
        "не лайкай",
        "не надо делать громче",
        "следующий слайд пожалуйста",
        "включи свет",
        "перемотай кассету в магнитофоне",
        "Лоля это не тебе я с мамой разговариваю",
    ] {
        assert!(heard_as_talk(text), "{text}");
    }
}

#[test]
fn a_command_and_a_phrase_without_command_words_are_not_talk() {
    for text in [
        "пауза",
        "сделай погромче",
        "громче нет тише",
        "включи кино",
        "как дела",
        "я устал",
    ] {
        assert!(!heard_as_talk(text), "{text}");
    }
}

#[test]
fn asking_to_say_something_is_not_asking_for_any_music() {
    let read = |text: &str| parse(text, &Names::new(&["Лоля"]))[0].intent;
    for text in [
        "расскажи что-нибудь",
        "скажи что-нибудь",
        "придумай что-нибудь",
        "Лоля расскажи что-нибудь",
        "ну расскажи мне что-нибудь",
    ] {
        assert_eq!(read(text), voice_nlu::Intent::None, "{text}");
    }
    for text in [
        "что-нибудь",
        "включи что-нибудь",
        "поставь что-нибудь",
        "ну давай что-нибудь",
        "спой что-нибудь",
        "скажи а включи что-нибудь",
    ] {
        assert_eq!(read(text), voice_nlu::Intent::PlayWave, "{text}");
    }
}
