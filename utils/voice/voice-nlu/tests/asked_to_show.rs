use voice_nlu::{Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

#[test]
fn a_request_to_show_the_likes_starts_no_music() {
    for text in [
        "открой мои лайки",
        "покажи мои лайки",
        "перейди в мои лайки",
        "покажи любимые треки",
        "открой любимое",
        "open my likes",
        "show my likes",
        "go to my likes",
        "take me to my likes",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn a_request_to_show_likes_does_not_touch_the_like() {
    for text in ["покажи лайк", "открой лайки", "show me the likes"] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn a_request_to_play_is_still_carried_out() {
    for (text, want) in [
        ("мои лайки", "play_likes"),
        ("включи мои лайки", "play_likes"),
        ("покажи и включи мои лайки", "play_likes"),
        ("открой окно включи мои лайки", "play_likes"),
        ("go on play my likes", "play_likes"),
        ("включи мою волну", "play_wave"),
        ("открой мою волну", "play_wave"),
        ("open my wave", "play_wave"),
        ("лайк", "like"),
        ("убери лайк", "unlike"),
        ("take it out of my likes", "unlike"),
    ] {
        assert_eq!(steps(text), [want], "{text}");
    }
}
