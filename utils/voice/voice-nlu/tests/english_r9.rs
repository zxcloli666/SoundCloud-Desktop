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
fn slang_and_roundabout_wording_of_player_commands() {
    acts(&[
        ("sound back on", "unmute"),
        ("bring back the music", "resume"),
        ("no repeat", "repeat_off"),
        ("no shuffle", "shuffle_off"),
        ("put it back like it was", "undo"),
        ("oops go back to how it was", "undo"),
        ("turn that racket down", "volume_down"),
        ("take it down a notch", "volume_down"),
        ("dont make it so loud", "volume_down"),
        ("bump it up a notch", "volume_up"),
        ("crank it", "volume_up"),
        ("i can hear nothing", "volume_up"),
        ("i cant hear a thing turn it up", "volume_up"),
        ("enough of this song", "next"),
        ("lemme hear something else", "next"),
        ("just stop already", "stop"),
        ("what can i say to you", "help"),
        ("i dont know how to use this", "help"),
        ("i dont like this song anymore", "unlike"),
        ("would you mind pausing", "pause"),
        ("give me some silence", "pause"),
        ("give me some peace and quiet", "pause"),
        ("would you mind turning it down", "volume_down"),
        ("quiet her please", "volume_down"),
        ("turn it up a little loud her", "volume_up"),
    ]);
    for text in ["set it to a hundred", "turn it up to a hundred"] {
        let said = &read(text)[0];
        assert_eq!(
            (said.intent, said.number),
            (Intent::VolumeSet, Some(100)),
            "{text}"
        );
    }
    assert_eq!(
        steps("next and dont make it so loud"),
        ["next", "volume_down"]
    );
    assert_eq!(
        steps("like this song and play something similar"),
        ["like", "play_similar"]
    );
}

#[test]
fn sorry_takes_back_what_was_said() {
    acts(&[
        ("shuffle on sorry off", "shuffle_off"),
        ("pause sorry next", "next"),
        ("sorry pause", "pause"),
    ]);
    assert_eq!(asks_for("play queen sorry i meant play adele"), "adele");
    assert_eq!(
        asks_for("play sorry seems to be the hardest word"),
        "sorry seems to be the hardest word"
    );
}

#[test]
fn a_name_taken_back_is_kept_as_a_second_reading() {
    for (text, name) in [
        ("play drake no taylor swift", "taylor swift"),
        ("play eminem uh no queen", "queen"),
        ("put on rihanna no no taylor swift", "taylor swift"),
        ("play believer sorry thunder", "thunder"),
    ] {
        let said = &read(text)[0];
        assert!(said.queries[0].text.contains(' '), "{text}");
        let taken_back = &said.split[0];
        assert_eq!(taken_back.len(), 1, "{text}");
        assert_eq!(taken_back[0].intent, Intent::Play, "{text}");
        assert_eq!(taken_back[0].queries[0].text, name, "{text}");
    }
    assert!(read("play no doubt")[0].split.is_empty());
}

#[test]
fn a_remark_about_the_speaker_after_an_order_leaves_the_order() {
    acts(&[
        ("skip this song i need to take a call", "next"),
        ("stop the music i have to go", "stop"),
    ]);
}

#[test]
fn questions_and_refusals_do_nothing() {
    for text in [
        "whats the weather like",
        "what does shuffle do",
        "do not queue rihanna",
        "dont add rihanna to the queue",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn more_frames_around_a_name() {
    for (text, name) in [
        ("give me some rammstein", "rammstein"),
        ("stick on coldplay", "coldplay"),
        ("how about some queen", "queen"),
        ("would you mind playing nirvana", "nirvana"),
        (
            "loli i know its late but i really want to hear nirvana",
            "nirvana",
        ),
    ] {
        assert_eq!(asks_for(text), name, "{text}");
    }
    assert_eq!(
        asks_for("play everything but the girl"),
        "everything but the girl"
    );
}
