use voice_nlu::sounds_unfinished;

#[test]
fn a_phrase_that_stops_on_a_linking_word_is_unfinished() {
    for text in [
        "я же попросил для",
        "я просто",
        "включи",
        "поставь мне",
        "ну",
        "это девятый трек в",
        "play the",
        "put on some",
    ] {
        assert!(sounds_unfinished(text), "{text}");
    }
}

#[test]
fn a_phrase_that_stops_on_a_name_or_a_command_is_finished() {
    for text in [
        "включи психосис",
        "пауза",
        "громкость двести",
        "ты меня прерываешь",
        "хуйня обрывается",
        "play psychosis",
        "",
    ] {
        assert!(!sounds_unfinished(text), "{text}");
    }
}
