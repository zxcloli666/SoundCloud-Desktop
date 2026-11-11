use voice_nlu::{Names, Parsed, parse};

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
