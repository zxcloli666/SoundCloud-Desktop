use voice_g2p::ru::Russian;

const CASES: &[(&str, &str)] = &[
    ("пять минут", "п+ять мин+ут"),
    ("потом", "пот+ом"),
    ("моя музыка", "мо+я м+узыка"),
    ("мой друг", "м+ой др+уг"),
    ("помочь", "пом+очь"),
    ("молодец", "молод+ец"),
    ("пора спать", "пор+а сп+ать"),
    ("это запах", "+это з+апах"),
    ("в этом году", "в +этом год+у"),
    ("стакан воды", "стак+ан вод+ы"),
    ("в 7 вечера", "в с+емь в+ечера"),
    ("в 8 утра", "в в+осемь утр+а"),
    ("два часа", "дв+а час+а"),
    ("три года", "тр+и г+ода"),
    ("5 мая 2024 года", "п+ять м+ая дв+е т+ысячи дв+адцать четв+ёртого г+ода"),
    ("в 2024 году", "в дв+е т+ысячи дв+адцать четв+ёртом год+у"),
    ("сорок секунд", "с+орок сек+унд"),
    ("включи волну", "включ+и волн+у"),
    ("в аэропорту", "в аэропорт+у"),
    ("на столе лежит пирог", "на стол+е леж+ит пир+ог"),
];

#[test]
fn defaults_follow_the_common_reading() {
    let ru = Russian::bundled();
    let mut bad = Vec::new();
    for (text, want) in CASES {
        let got = ru.speak(text).chars;
        if got != *want {
            bad.push(format!("{text:?}\n  want {want:?}\n  got  {got:?}"));
        }
    }
    assert!(bad.is_empty(), "\n{}", bad.join("\n"));
}

#[test]
fn explicit_mark_beats_the_default() {
    let ru = Russian::bundled();
    assert_eq!(ru.speak("м+ино").chars, "м+ино");
    assert_eq!(ru.speak("зам+ок").chars, "зам+ок");
    assert_eq!(ru.speak("з+амок").chars, "з+амок");
    assert_eq!(ru.speak("ми+нут").chars, "ми+нут");
}

#[test]
fn alternatives_stay_after_the_default() {
    let ru = Russian::bundled();
    let word = ru.stress("минут");
    assert_eq!(word.stress, Some(3));
    assert_eq!(word.alternatives, vec![1]);
}
