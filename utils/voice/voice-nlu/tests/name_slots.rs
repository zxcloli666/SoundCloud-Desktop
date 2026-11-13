use voice_nlu::{Kind, Names, Parsed, Variant, parse};

const LOLI: [&str; 3] = ["Loli", "Лоля", "롤리"];

fn said(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&LOLI))
}

fn without(text: &str) -> Vec<Parsed> {
    let mut steps = parse(text, &Names::default());
    steps.iter_mut().for_each(|step| step.heard.clear());
    steps
}

fn heard_as(text: &str, plain: &str) {
    let mut steps = said(text);
    steps.iter_mut().for_each(|step| step.heard.clear());
    assert_eq!(steps, without(plain), "{text}");
}

fn names(text: &str) -> Vec<String> {
    let steps = said(text);
    steps[0].queries.iter().map(|q| q.text.clone()).collect()
}

#[test]
fn the_assistant_called_after_a_command_that_ends_with_its_verb_is_left_out() {
    let cases = [
        ("бибера включи лоля", "бибера включи"),
        ("коржа поставь, лоля", "коржа поставь"),
        ("мотыльков вруби лоля", "мотыльков вруби"),
        ("группу кино запусти loli", "группу кино запусти"),
        ("а земфиру мне поставь лоля", "а земфиру мне поставь"),
    ];
    for (text, plain) in cases {
        heard_as(text, plain);
    }
}

#[test]
fn the_name_after_a_verb_with_nothing_named_before_it_is_still_what_to_play() {
    let cases = [
        ("включи лоля", "лоля"),
        ("а ну включи лоля", "лоля"),
        ("бибера включи лолю", "лолю"),
        ("потом включи лолю", "лолю"),
        ("включи группу лоля", "лоля"),
    ];
    for (text, name) in cases {
        assert!(names(text).iter().any(|q| q == name), "{text}");
    }
}

#[test]
fn a_word_for_haste_next_to_the_verb_is_not_part_of_the_name() {
    let cases = [
        ("включи быстренько мокрые кроссовки", "мокрые кроссовки"),
        (
            "поставь побыстрее дом с нормальными явлениями",
            "дом с нормальными явлениями",
        ),
        ("вруби поскорее кино", "кино"),
        ("запусти срочно басту", "басту"),
        ("поставь по-быстрому земфиру", "земфиру"),
        ("немедленно включи лесника", "лесника"),
        ("скорей поставь сплин", "сплин"),
    ];
    for (text, name) in cases {
        assert_eq!(names(text)[0], name, "{text}");
    }
}

#[test]
fn the_one_who_performs_a_title_is_its_artist() {
    let cases = [
        ("включи притон в исполнении дорадуры", "притон", "дорадуры"),
        (
            "поставь кукушку в исполнении гагариной",
            "кукушку",
            "гагариной",
        ),
        (
            "включи лесника в исполнение короля и шута",
            "лесника",
            "короля и шута",
        ),
    ];
    for (text, title, artist) in cases {
        let steps = said(text);
        let split = |q: &&Variant| q.title.as_deref() == Some(title);
        let joint = steps[0].queries.iter().find(split);
        let by = joint.and_then(|q| q.artist.as_deref());
        assert_eq!(by, Some(artist), "{text}");
    }
}

#[test]
fn words_that_only_say_a_name_follows_are_left_out() {
    let cases = [
        ("поставь группу которая называется плей", "play"),
        ("включи песню под названием лесник", "лесник"),
        (
            "поставь альбом который называется группа крови",
            "группа крови",
        ),
        ("включи плейлист с названием дорога домой", "дорога домой"),
    ];
    for (text, name) in cases {
        assert_eq!(names(text)[0], name, "{text}");
    }
}

fn ends(text: &str) -> Vec<String> {
    let steps = said(text);
    let parts = steps[0].queries.iter().filter(|q| q.fallback);
    parts.map(|q| q.text.clone()).collect()
}

#[test]
fn up_to_three_words_at_an_end_of_a_name_of_five_may_be_the_artist() {
    let named = [
        ("включи короля и шута проклятый старый дом", "король и шут"),
        (
            "включи наутилус помпилиус прогулки по воде",
            "наутилус помпилиус",
        ),
        ("включи проклятый старый дом короля и шута", "король и шут"),
        ("включи кино про войну и мир", "кино"),
    ];
    for (text, artist) in named {
        assert!(ends(text).iter().any(|part| part == artist), "{text}");
    }
    assert!(ends("включи на ютубе тот ролик про скриптонита").is_empty());
}

#[test]
fn the_word_version_is_a_word_for_a_track_and_not_a_part_of_its_name() {
    let cases = [
        (
            "включи караоке версию блайндинг лайтс",
            "караоке блайндинг лайтс",
        ),
        ("включи пиано версию бэд гай", "пиано бэд гай"),
        ("поставь версию лесника", "лесника"),
        ("версия кукушки включи", "кукушки"),
    ];
    for (text, name) in cases {
        assert_eq!(names(text)[0], name, "{text}");
        assert_eq!(said(text)[0].kind_hint, Some(Kind::Track), "{text}");
    }
}

#[test]
fn a_word_usually_left_out_is_the_name_when_it_is_all_that_follows_its_kind() {
    let named = [
        ("включи песню знаешь", "знаешь", Kind::Track),
        ("включи группу алиса", "алиса", Kind::Artist),
        ("поставь трек смотри", "смотри", Kind::Track),
        ("включи плейлист окей", "окей", Kind::Playlist),
    ];
    for (text, name, kind) in named {
        let steps = said(text);
        assert_eq!(steps[0].queries[0].text, name, "{text}");
        assert_eq!(steps[0].kind_hint, Some(kind), "{text}");
    }
    let steps = said("включи песню знаешь а потом кино");
    assert_eq!(steps.len(), 2);
    assert_eq!(steps[0].queries[0].text, "знаешь");
    assert_eq!(steps[1].queries[0].text, "кино");
}

#[test]
fn a_sound_of_doubt_or_a_polite_word_after_a_kind_is_not_its_name() {
    let unnamed = [
        "включи песню пожалуйста",
        "включи трек ну",
        "включи песню эээ",
        "включи альбом спасибо",
        "поставь песню please",
    ];
    for text in unnamed {
        assert_eq!(names(text), Vec::<String>::new(), "{text}");
    }
    assert_eq!(names("включи группу алиса трасса е 95")[0], "трасса е 95");
    assert_eq!(names("алиса включи кино")[0], "кино");
}
