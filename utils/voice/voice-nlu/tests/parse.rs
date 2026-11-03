use voice_nlu::{Intent, Kind, normalize, parse_one as parse};

fn words(text: &str) -> String {
    normalize(text).text
}

#[test]
fn normalizes_spelling_and_numbers() {
    assert_eq!(words("Хааачу СКРИПТОНИТА!!!"), "хочу скриптонита");
    assert_eq!(
        words("громкость двадцать пять процентов"),
        "громкость 25 процентов"
    );
    assert_eq!(words("включи сто четыре"), "включи 104");
    assert_eq!(words("двадцать пять семнадцать"), "25 17");
    assert_eq!(words("ну э-э-э типа пауза"), "пауза");
    assert_eq!(words("перемотай на 1:30"), "перемотай на 1:30");
    assert_eq!(words("Beggin' — Måneskin"), "beggin - måneskin");
}

#[test]
fn ambiguous_fillers_survive_in_the_second_variant() {
    let p = parse("включи брат 2");
    assert_eq!(p.intent, Intent::Play);
    assert!(
        p.queries
            .iter()
            .any(|q| q.text == "брат 2" && q.kept_fillers)
    );
    assert!(p.queries.iter().any(|q| q.text == "2" && !q.kept_fillers));
}

#[test]
fn intents_and_numbers() {
    let cases = [
        ("громкость на половину", Intent::VolumeSet, Some(50)),
        ("перемотай на минуту тридцать", Intent::SeekTo, Some(90)),
        ("прыгни на 1 минуту 20 секунд", Intent::SeekTo, Some(80)),
        ("назад на 15 секунд", Intent::SeekBackward, Some(15)),
        ("перемотай вперёд", Intent::SeekForward, Some(10)),
        ("поставь на паузу", Intent::Pause, None),
        ("включи", Intent::Resume, None),
        ("включи что-нибудь", Intent::PlayWave, None),
        ("скриптонит вообще крутой", Intent::None, None),
        ("включи свет", Intent::None, None),
        ("мне нравится билли айлиш", Intent::None, None),
    ];
    for (text, intent, number) in cases {
        let p = parse(text);
        assert_eq!(p.intent, intent, "{text}");
        assert_eq!(p.number, number, "{text}");
    }
}

#[test]
fn slots_split_artist_and_title() {
    let p = parse("включи песню притон от скриптонита");
    assert_eq!(p.intent, Intent::Play);
    assert_eq!(p.kind_hint, Some(Kind::Track));
    let joint = p.queries.iter().find(|q| q.title.is_some()).unwrap();
    assert_eq!(joint.title.as_deref(), Some("притон"));
    assert!(
        p.queries
            .iter()
            .any(|q| q.artist.as_deref() == Some("скриптонит"))
    );

    let p = parse("поставь песни макса коржа");
    assert_eq!(p.kind_hint, Some(Kind::Artist));
    assert!(p.queries.iter().any(|q| q.text == "макс корж"));
}

#[test]
fn lemma_rules_cover_common_case_forms() {
    use voice_nlu::lemma;
    let pairs = [
        ("скриптонита", "скриптонит"),
        ("коржа", "корж"),
        ("земфиры", "земфира"),
        ("монеточки", "монеточка"),
        ("моргенштерна", "моргенштерн"),
        ("цоя", "цой"),
        ("тролля", "тролль"),
        ("басту", "баста"),
        ("высоцкого", "высоцкий"),
        ("зверей", "звери"),
    ];
    for (form, base) in pairs {
        assert_eq!(lemma(form, 1), base, "{form}");
    }
}
