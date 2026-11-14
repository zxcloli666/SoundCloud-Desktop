use voice_nlu::{Intent, Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

fn acts(rows: &[(&str, &str)]) {
    for (text, want) in rows {
        assert_eq!(steps(text), [*want], "{text}");
    }
}

fn asks_for(text: &str) -> String {
    let said = read(text);
    assert_eq!(said.len(), 1, "{text}");
    assert_eq!(said[0].intent, Intent::Play, "{text}");
    said[0].queries[0].text.clone()
}

#[test]
fn loose_wording_of_player_commands() {
    acts(&[
        ("go on", "resume"),
        ("start it up again", "resume"),
        ("hit play again", "resume"),
        ("not this one", "next"),
        ("hard to hear this", "volume_up"),
        ("cant hear shit", "volume_up"),
        ("holy crap thats loud", "volume_down"),
        ("no more shuffle", "shuffle_off"),
        ("play this song again and again", "repeat_one"),
        ("what the hell is this song", "now_playing"),
        ("put it back", "undo"),
        ("oops undo that", "undo"),
        ("oh my god turn it down already", "volume_down"),
        ("dude seriously pause the thing", "pause"),
        ("uhh like next or something", "next"),
        ("fast forward", "seek_forward"),
        ("well that was awful next", "next"),
        ("how do i use you", "help"),
    ]);
    let said = &read("turn it all the way up")[0];
    assert_eq!((said.intent, said.number), (Intent::VolumeSet, Some(100)));
}

#[test]
fn a_remark_about_something_else_after_an_order_is_cut() {
    acts(&[("ok loli turn it down i cant think", "volume_down")]);
    assert_eq!(
        asks_for("play lose yourself by eminem the pizza is here"),
        "lose yourself eminem"
    );
    let named = &read("play bob marley the sun is shining")[0];
    assert!(
        named
            .alt
            .iter()
            .any(|q| q.text == "bob marley the sun is shining")
    );
}

#[test]
fn talk_that_only_sounds_like_an_order_does_nothing() {
    for text in [
        "ill be back in a minute",
        "be right back",
        "and the next song on the countdown is",
        "slow down you move too fast",
        "whats the best way to resume a cv",
        "that coldplay concert was so boring",
        "can you play the piano",
        "how do i skip a song",
        "how do i mute a zoom call",
        "how do you say pause in spanish",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn long_polite_wrappers_around_a_name() {
    for (text, name) in [
        (
            "i would really like it if you could put on some dua lipa right now",
            "dua lipa",
        ),
        (
            "if its not too much trouble could you put on some post malone",
            "post malone",
        ),
        ("could we have some eminem", "eminem"),
        ("play something new from dua lipa", "dua lipa"),
        ("play queen no not queen play nirvana", "nirvana"),
        ("play nirvana come as you are", "nirvana come as you are"),
    ] {
        assert_eq!(asks_for(text), name, "{text}");
    }
    assert_eq!(
        asks_for("play the one that goes in the end by linkin park"),
        "in the end linkin park"
    );
}

#[test]
fn an_owner_of_songs_is_also_asked_for_without_the_ending() {
    for (text, name) in [
        ("play drakes hits", "drake"),
        ("play the weeknds songs", "the weeknd"),
    ] {
        let said = &read(text)[0];
        assert!(said.queries.iter().any(|q| q.text == name), "{text}");
    }
}
