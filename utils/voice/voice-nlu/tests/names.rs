use voice_nlu::{Names, Parsed, parse};

const LOLI: [&str; 5] = ["Loli", "Лоля", "Loli", "롤리", "Loli"];
const MORIARTY: [&str; 3] = ["Moriarty", "Мориарти", "모리아티"];

fn said(text: &str, names: &[&str]) -> Vec<Parsed> {
    parse(text, &Names::new(names))
}

fn without(text: &str) -> Vec<Parsed> {
    let mut steps = parse(text, &Names::default());
    steps.iter_mut().for_each(|step| step.heard.clear());
    steps
}

fn heard_as(text: &str, plain: &str) {
    let mut steps = said(text, &LOLI);
    assert!(steps.iter().all(|step| step.heard == text), "{text}");
    steps.iter_mut().for_each(|step| step.heard.clear());
    assert_eq!(steps, without(plain), "{text}");
}

#[test]
fn a_name_said_to_the_assistant_is_left_out() {
    let cases = [
        ("привет, лоля", "привет"),
        ("лоля, привет", "привет"),
        ("спасибо, лоля", "спасибо"),
        ("лоля", ""),
        ("loli, hi", "hi"),
        ("롤리", ""),
        ("привет, лоля, как дела?", "привет, как дела?"),
        ("лоля, включи кино", "включи кино"),
        ("включи кино, лоля", "включи кино"),
        ("лоля поставь на паузу", "поставь на паузу"),
        ("Лоля, сделай погромче", "сделай погромче"),
        ("давай, лоля, следующий", "давай, следующий"),
        ("лоля, включи лолю", "включи лолю"),
    ];
    for (text, plain) in cases {
        heard_as(text, plain);
    }
}

#[test]
fn every_case_of_the_russian_name_is_heard_as_the_name() {
    for form in ["лоля", "лоль", "лолю", "лоле", "лолей", "лоли"] {
        heard_as(&format!("{form}, включи кино"), "включи кино");
        let object = said(&format!("включи {form}"), &LOLI);
        assert!(object[0].queries.iter().any(|q| q.text == form), "{form}");
    }
}

#[test]
fn a_name_that_is_the_object_of_a_command_is_kept() {
    let cases = [
        ("включи лолю", "лолю"),
        ("поставь loli", "loli"),
        ("включи исполнителя лоля", "лоля"),
        ("включи мне лолю", "лолю"),
        ("включи песню от лоли", "лоли"),
        ("добавь лолю в очередь", "лолю"),
    ];
    for (text, name) in cases {
        let steps = said(text, &LOLI);
        assert_eq!(steps, parse(text, &Names::default()), "{text}");
        assert!(steps[0].queries.iter().any(|q| q.text == name), "{text}");
    }
}

#[test]
fn only_the_names_of_the_active_voice_are_left_out() {
    for text in ["привет, лоля", "включи кино, лоля", "лоля"] {
        assert_eq!(
            said(text, &MORIARTY),
            parse(text, &Names::default()),
            "{text}"
        );
    }
    let mut steps = said("привет, мориарти", &MORIARTY);
    steps[0].heard.clear();
    assert_eq!(steps, without("привет"));
}
