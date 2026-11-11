use voice_nlu::{Names, Parsed, Variant, parse};

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
