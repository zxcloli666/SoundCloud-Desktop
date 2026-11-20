use voice_nlu::{Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
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
fn complaints_change_the_volume_or_skip() {
    acts(&[
        ("its too loud", "volume_down"),
        ("way too loud", "volume_down"),
        ("its too quiet", "volume_up"),
        ("its so quiet", "volume_up"),
        ("i cant hear myself think", "volume_down"),
        ("im sick of this song", "next"),
        ("this song sucks", "next"),
        ("this song is awful", "next"),
        ("i hate this track", "next"),
        ("so boring", "next"),
        ("not this again", "next"),
        ("i dont wanna hear this", "next"),
    ]);
}

#[test]
fn going_on_and_bringing_things_back() {
    acts(&[
        ("keep playing", "resume"),
        ("unpause", "resume"),
        ("carry on", "resume"),
        ("pause no keep playing", "resume"),
        ("bring the sound back", "unmute"),
        ("put it back how it was", "undo"),
        ("stop looping", "repeat_off"),
        ("repeat the playlist", "repeat_all"),
        ("play mute", "mute"),
    ]);
}

#[test]
fn likes_are_added_and_removed() {
    acts(&[
        ("add this to my likes", "like"),
        ("remove this from my likes", "unlike"),
        ("take it off my likes", "unlike"),
        ("can you like this song", "like"),
    ]);
}

#[test]
fn like_said_in_passing_is_not_a_like() {
    acts(&[
        ("so like can you maybe turn it up a little", "volume_up"),
        ("id like to hear dua lipa", "play"),
    ]);
}

#[test]
fn questions_about_the_track_and_the_commands() {
    acts(&[
        ("what am i listening to", "now_playing"),
        ("whats the name of this track", "now_playing"),
        ("tell me whats playing", "now_playing"),
        ("what commands do you have", "help"),
    ]);
}

#[test]
fn a_name_asked_for_next_is_queued() {
    acts(&[
        ("play eminem next", "queue_add"),
        ("after this play umbrella", "queue_add"),
        ("play the next one", "next"),
    ]);
    for text in [
        "play queen and then play drake",
        "play drake followed by the weeknd",
        "play ed sheeran and then after that coldplay",
    ] {
        assert_eq!(steps(text), ["play", "queue_add"], "{text}");
    }
}

#[test]
fn talk_to_someone_else_does_nothing() {
    stays_silent(&[
        "mom stop",
        "tell mom to turn the music down",
        "you are on mute",
        "can you hear me now",
        "make the radio quieter",
        "did you hear the new taylor swift",
        "please dont put on eminem",
    ]);
}

#[test]
fn polite_and_slang_wording_still_asks() {
    acts(&[
        ("would you mind skipping this song", "next"),
        ("i would really appreciate it if you could pause", "pause"),
        ("gimme some queen", "play"),
        ("throw on eminem", "play"),
        ("yo play some eminem dude", "play"),
    ]);
    let said = &read("play drake no play eminem")[0];
    assert!(said.queries.iter().any(|q| q.text == "eminem"));
    assert!(said.queries.iter().all(|q| !q.text.contains("drake")));
}

#[test]
fn volume_said_in_words() {
    assert_eq!(read("set volume to one hundred")[0].number, Some(100));
    assert_eq!(read("half volume")[0].number, Some(50));
    assert_eq!(read("volume to two hundred fifty")[0].number, Some(100));
}
