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
fn everyday_wording_of_player_commands() {
    acts(&[
        ("enough", "stop"),
        ("okay thats enough music", "stop"),
        ("yo pause that thing", "pause"),
        ("pause the phone is ringing", "pause"),
        ("cant hear a thing in here", "volume_up"),
        ("make it twice as loud", "volume_up"),
        ("i want it silent", "mute"),
        ("heart this song", "like"),
        ("like this song", "like"),
        ("play the one before this", "previous"),
        ("what do you know how to do", "help"),
        ("play what i liked", "play_likes"),
        ("play the stuff i like", "play_likes"),
        ("throw on some tunes", "play_wave"),
        ("i need some music", "play_wave"),
        ("lets hear something new", "play_wave"),
        ("something like what is playing", "play_similar"),
        ("something like this", "play_similar"),
    ]);
}

#[test]
fn a_request_for_more_of_the_same_names_nothing() {
    for text in ["something like this", "more like this"] {
        let said = &read(text)[0];
        assert_eq!(said.intent, Intent::PlaySimilar, "{text}");
        assert!(said.queries.is_empty(), "{text}");
    }
}

#[test]
fn a_volume_level_said_without_the_word_volume() {
    for (text, level) in [
        ("make it sixty percent", 60),
        ("turn it to sixty", 60),
        ("set the volume to a quarter", 25),
    ] {
        let said = &read(text)[0];
        assert_eq!(
            (said.intent, said.number),
            (Intent::VolumeSet, Some(level)),
            "{text}"
        );
    }
}

#[test]
fn questions_and_remarks_with_a_command_word_do_nothing() {
    for text in [
        "what is shuffle",
        "whats repeat",
        "how loud is too loud",
        "who paused the music",
        "fair enough",
        "thats not enough",
        "enough coldplay already",
        "the phone is ringing",
        "the volume of trade increased last quarter",
        "i think rammstein is too loud for the baby",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
    assert!(read("enough coldplay already")[0].queries.is_empty());
}

#[test]
fn slang_and_long_lead_ins_around_a_name() {
    for (text, name) in [
        ("whack on some queen", "queen"),
        ("chuck on some drake", "drake"),
        ("drop some kendrick lamar", "kendrick lamar"),
        ("lets hear some rammstein", "rammstein"),
        ("can we get some taylor swift", "taylor swift"),
        ("i really feel like hearing some rammstein", "rammstein"),
        ("is there any chance you could play dua lipa", "dua lipa"),
        ("play eminem on second thought bruno mars", "bruno mars"),
        (
            "okay so my friends are coming over could you play something by dua lipa",
            "dua lipa",
        ),
        (
            "i know its a lot to ask but can you play lose yourself by eminem",
            "lose yourself eminem",
        ),
    ] {
        assert_eq!(asks_for(text), name, "{text}");
    }
    let named = &read("play you know that song shape of you")[0];
    assert!(named.queries.iter().any(|q| q.text == "shape of you"));
}

#[test]
fn a_request_to_someone_else_is_not_cut_out_of_its_lead_in() {
    assert_eq!(
        steps("mom when you get a second could you play something by dua lipa"),
        ["none"]
    );
}

#[test]
fn what_comes_after_is_queued() {
    assert_eq!(steps("add rap god after this"), ["queue_add"]);
    assert_eq!(steps("play bad guy and next lovely"), ["play", "queue_add"]);
    assert_eq!(
        steps("play eminem and after him queen and louder"),
        ["play", "queue_add", "volume_up"]
    );
}

#[test]
fn an_owner_of_songs_is_named_without_the_words_around_it() {
    for (text, name) in [
        ("play some queens songs", "queen"),
        ("play some of drakes stuff", "drake"),
    ] {
        let said = &read(text)[0];
        assert!(said.queries.iter().any(|q| q.text == name), "{text}");
    }
}
