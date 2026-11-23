use voice_nlu::{Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
        .iter()
        .map(|p| p.intent.name())
        .collect()
}

#[test]
fn a_misheard_removal_before_the_like_sets_no_like() {
    for text in ["угри лайк", "убре лайк", "уди лайк"] {
        assert!(!steps(text).contains(&"like"), "{text}: {:?}", steps(text));
    }
}

#[test]
fn other_words_before_the_like_still_set_it() {
    for text in [
        "поставь лайк",
        "постав лайк",
        "пастав лайк",
        "это бомба лайк",
    ] {
        assert_eq!(steps(text), ["like"], "{text}");
    }
    assert_eq!(steps("убери лайк"), ["unlike"]);
}
