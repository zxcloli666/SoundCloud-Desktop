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

fn moves(rows: &[(&str, Intent, u32)]) {
    for (text, intent, secs) in rows {
        let said = read(text);
        assert_eq!(said.len(), 1, "{text}");
        assert_eq!(
            (said[0].intent, said[0].number),
            (*intent, Some(*secs)),
            "{text}"
        );
    }
}

#[test]
fn a_spoken_amount_of_time_is_counted() {
    moves(&[
        ("skip ahead half a minute", Intent::SeekForward, 30),
        ("rewind half a minute", Intent::SeekBackward, 30),
        ("half a minute back", Intent::SeekBackward, 30),
        ("skip ahead one and a half minutes", Intent::SeekForward, 90),
        ("jump ahead a minute and a half", Intent::SeekForward, 90),
        ("go back a few seconds", Intent::SeekBackward, 5),
        ("go back a couple of seconds", Intent::SeekBackward, 2),
        ("back it up ten seconds", Intent::SeekBackward, 10),
        ("перейди назад на 10 секунд", Intent::SeekBackward, 10),
    ]);
}

#[test]
fn a_named_place_in_the_track_is_gone_to() {
    moves(&[
        ("go to the two minute mark", Intent::SeekTo, 120),
        ("go to the one minute thirty mark", Intent::SeekTo, 90),
        ("go to the 30 second mark", Intent::SeekTo, 30),
        ("jump to minute three", Intent::SeekTo, 180),
        ("go to minute two", Intent::SeekTo, 120),
        ("go to a minute thirty", Intent::SeekTo, 90),
        ("jump to one thirty", Intent::SeekTo, 90),
        ("two minutes in", Intent::SeekTo, 120),
        ("skip the first minute", Intent::SeekTo, 60),
        ("play from two minutes", Intent::SeekTo, 120),
        ("прыгни на 1 минуту 20 секунд", Intent::SeekTo, 80),
    ]);
    for text in ["go to the middle", "skip to the halfway point"] {
        let said = &read(text)[0];
        assert_eq!(
            (said.intent, said.fraction),
            (Intent::SeekTo, Some(0.5)),
            "{text}"
        );
    }
    acts(&[("skip to the end", "next"), ("go to the end", "next")]);
}

#[test]
fn the_track_is_started_over() {
    for text in [
        "start over",
        "start this song over",
        "from the beginning",
        "take it from the top",
        "go to the start",
        "go back to the start",
        "play it from the start",
        "start the song from the beginning",
        "rewind to the beginning",
        "play it again",
        "play this song again",
        "включи песню сначала",
        "включи песню с самого начала",
        "включи песню ещё раз",
    ] {
        moves(&[(text, Intent::SeekTo, 0)]);
    }
    assert_eq!(steps("play start over"), ["play"]);
}

#[test]
fn a_little_one_way_moves_within_the_track() {
    moves(&[
        ("go back a bit", Intent::SeekBackward, 10),
        ("back up a little", Intent::SeekBackward, 10),
        ("jump back", Intent::SeekBackward, 10),
        ("forward a bit", Intent::SeekForward, 10),
        ("jump forward", Intent::SeekForward, 10),
        ("scrub forward a bit", Intent::SeekForward, 10),
        ("чуть назад", Intent::SeekBackward, 10),
        ("немного вперёд", Intent::SeekForward, 10),
    ]);
    acts(&[
        ("go back", "previous"),
        ("skip back", "previous"),
        ("назад", "previous"),
        ("верни назад", "previous"),
        ("skip forward", "next"),
        ("skip ahead", "next"),
        ("go forward", "next"),
        ("dial it back a bit", "volume_down"),
    ]);
}

#[test]
fn like_before_an_order_is_a_filler() {
    for text in [
        "can you like play umbrella by rihanna",
        "so can you like play some rihanna",
        "like put on that song umbrella by rihanna",
        "id like to play some drake",
    ] {
        assert_eq!(steps(text), ["play"], "{text}");
    }
    acts(&[
        ("like skip this", "next"),
        ("just like turn it down", "volume_down"),
        ("i like this", "like"),
        ("like this song", "like"),
    ]);
}

#[test]
fn an_order_said_again_in_english_is_done() {
    acts(&[
        ("i said pause", "pause"),
        ("i said stop", "stop"),
        ("i said next", "next"),
        ("not this one again", "next"),
        ("not again", "next"),
        ("he said pause", "none"),
        ("and i said pause the movie", "none"),
    ]);
}

#[test]
fn everyday_english_wording_is_understood() {
    acts(&[
        ("thumbs up", "like"),
        ("i love this song", "like"),
        ("love it", "like"),
        ("play in order", "shuffle_off"),
        ("surprise me", "play_wave"),
        ("recommend me something", "play_wave"),
        ("take that back", "undo"),
        ("my ears are bleeding", "volume_down"),
        ("kill the music", "stop"),
        ("kill the sound", "mute"),
        ("i need some silence", "pause"),
        ("what is love", "none"),
        ("i love you", "none"),
    ]);
    moves(&[
        ("run it back", Intent::SeekTo, 0),
        ("turn it up to eighty", Intent::VolumeSet, 80),
        ("turn it down to twenty", Intent::VolumeSet, 20),
        ("take it back ten seconds", Intent::SeekBackward, 10),
    ]);
    assert_eq!(steps("i would love to hear queen"), ["play"]);
}

#[test]
fn a_threat_after_an_order_is_not_an_order() {
    for text in [
        "ага включи ещё раз эту песню и я выкину колонку в окно",
        "включи громче и я выкину колонку в окно",
        "ещё раз включишь и я тебя выброшу",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
    acts(&[
        ("поставь на паузу и я отвечу на звонок", "pause"),
        ("включи ещё раз эту песню", "seek_to"),
    ]);
}
