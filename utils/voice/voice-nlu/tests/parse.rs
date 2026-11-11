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
fn a_greeting_after_a_play_verb_is_kept_as_a_name() {
    let named = [
        "включи привет",
        "поставь привет, пожалуйста",
        "вруби привет",
    ];
    let plain = ["включи", "включи, пожалуйста", "привет, включи"];
    for text in named {
        let p = parse(text);
        assert_eq!(p.intent, Intent::Resume, "{text}");
        assert!(!p.alt.is_empty(), "{text}");
        assert!(p.alt.iter().all(|name| name.text == "привет"), "{text}");
    }
    for text in plain {
        let p = parse(text);
        assert_eq!(p.intent, Intent::Resume, "{text}");
        assert!(p.alt.is_empty(), "{text}");
    }
}

#[test]
fn a_greeting_after_a_play_verb_and_a_kind_is_kept_as_a_name() {
    for text in ["включи песню привет", "поставь трек привет"] {
        let p = parse(text);
        assert_eq!(p.intent, Intent::Resume, "{text}");
        assert!(!p.alt.is_empty(), "{text}");
        assert!(p.alt.iter().all(|name| name.text == "привет"), "{text}");
    }
    let wave = parse("включи песню");
    assert_eq!((wave.intent, wave.alt.len()), (Intent::PlayWave, 0));
}

#[test]
fn a_greeting_said_alone_is_not_a_name_to_look_up() {
    for text in ["привет", "hi", "hello", "Hello!"] {
        let p = parse(text);
        assert_eq!(p.intent, Intent::None, "{text}");
        assert!(p.queries.is_empty(), "{text}");
    }
    assert!(!parse("hello from the other side").queries.is_empty());
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

#[test]
fn two_part_commands_run_in_order() {
    let names = |t: &str| -> Vec<&'static str> {
        voice_nlu::parse(t)
            .iter()
            .map(|p| p.intent.name())
            .collect()
    };
    assert_eq!(
        names("выключи повтор и перемешай"),
        ["repeat_off", "shuffle_on"]
    );
    assert_eq!(names("сделай погромче и следующий"), ["volume_up", "next"]);
    assert_eq!(names("выключи и включи скриптонита"), ["play"]);
    assert_eq!(names("включи король и шут"), ["play"]);
    assert_eq!(names("поставь на паузу мне звонят"), ["pause"]);
    assert_eq!(names("не надо паузу"), ["none"]);
    assert_eq!(names("не, дальше"), ["next"]);
}

fn steps(t: &str) -> Vec<&'static str> {
    voice_nlu::parse(t)
        .iter()
        .map(|p| p.intent.name())
        .collect()
}

#[test]
fn corrections_keep_the_last_version() {
    assert_eq!(steps("громче нет тише"), ["volume_down"]);
    assert_eq!(steps("следующий ой назад"), ["previous"]);
    let p = &voice_nlu::parse("громкость на тридцать нет на сорок")[0];
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(40)));
    let p = &voice_nlu::parse("включи басту нет скриптонита")[0];
    assert!(p.queries.iter().any(|q| q.text == "скриптонита"));
    assert!(!p.queries.iter().any(|q| q.text.contains("баст")));
}

#[test]
fn negation_covers_every_verb_form_and_each_step() {
    assert_eq!(steps("не лайкай"), ["none"]);
    assert_eq!(steps("не лайкни"), ["none"]);
    assert_eq!(steps("не скипай"), ["none"]);
    assert_eq!(steps("лайкни но не скипай"), ["like"]);
    assert_eq!(
        steps("выключи повтор и перемешивание"),
        ["repeat_off", "shuffle_off"]
    );
}

#[test]
fn unknown_words_around_a_command_are_tolerated() {
    assert_eq!(steps("сделай погромче а то не слышно"), ["volume_up"]);
    assert_eq!(steps("ёпт пауза"), ["pause"]);
    assert_eq!(steps("эээ ну следующий наверное"), ["next"]);
    assert_eq!(steps("пауза в разговоре затянулась"), ["none"]);
    assert_eq!(steps("следующая остановка"), ["none"]);
    assert_eq!(steps("перемешай колоду"), ["none"]);
}

#[test]
fn loan_slang_and_regional_forms_by_stem() {
    for (text, want) in [
        ("репитни", "repeat_one"),
        ("мьютни", "mute"),
        ("размуть", "unmute"),
        ("перетасуй", "shuffle_on"),
        ("плейни", "resume"),
        ("далі", "next"),
        ("гучніше", "volume_up"),
        ("цішэй", "volume_down"),
    ] {
        assert_eq!(steps(text), [want], "{text}");
    }
}

#[test]
fn numbers_fractions_and_signed_seeks() {
    let one = |t: &str| voice_nlu::parse(t).remove(0);
    assert_eq!(one("громкость на семь из десяти").number, Some(70));
    assert_eq!(one("громкость три").number, Some(30));
    assert_eq!(one("на середину").fraction, Some(0.5));
    let p = one("минус десять секунд");
    assert_eq!((p.intent, p.number), (Intent::SeekBackward, Some(10)));
    let p = one("плюс тридцать секунд");
    assert_eq!((p.intent, p.number), (Intent::SeekForward, Some(30)));
}
