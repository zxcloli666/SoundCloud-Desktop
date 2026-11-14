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

#[test]
fn everyday_wording_of_player_commands() {
    acts(&[
        ("go back one song", "previous"),
        ("gimme the last song again", "previous"),
        ("change the song", "next"),
        ("play another one", "next"),
        ("different song", "next"),
        ("this is getting old", "next"),
        ("i dont like this song", "next"),
        ("ugh this one again", "next"),
        ("whats this called", "now_playing"),
        ("name of this song", "now_playing"),
        ("thats a bit low", "volume_up"),
        ("its a bit loud", "volume_down"),
        ("lower", "volume_down"),
        ("random order", "shuffle_on"),
        ("mix it up", "shuffle_on"),
        ("stop shuffling", "shuffle_off"),
        ("shuffle on no off", "shuffle_off"),
        ("love this one", "like"),
        ("how do i use you", "help"),
        ("what commands do you know", "help"),
        ("restore the sound", "unmute"),
        ("go back to how it was", "undo"),
        ("play whatever", "play_wave"),
        ("skip this one", "next"),
    ]);
    let said = &read("volume ten percent")[0];
    assert_eq!((said.intent, said.number), (Intent::VolumeSet, Some(10)));
}

#[test]
fn a_remark_with_its_own_subject_after_an_order_leaves_the_order() {
    acts(&[
        ("pause the delivery guy is here", "pause"),
        ("volume down the baby is sleeping", "volume_down"),
    ]);
}

#[test]
fn questions_and_talk_about_other_things_do_nothing() {
    for text in [
        "why is it so loud in here",
        "did you pause it",
        "do you want me to turn it up",
        "my phone is on mute",
        "the next train is at five",
        "the next song on the setlist was terrible",
        "louder than life is a good book",
        "the repeat button is broken on my remote",
        "i wish this would stop",
        "next up on the show is nirvana",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn more_ways_to_ask_for_a_name() {
    for text in [
        "blast some linkin park",
        "lemme hear some rammstein",
        "play the one by coldplay called yellow",
        "i feel like listening to the weeknd",
        "loli could you please be so kind and play a bit of nirvana",
    ] {
        assert_eq!(steps(text), ["play"], "{text}");
    }
}
