use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Decision, FixtureCatalog, Outcome, interpret};

const BOTH: [Bare; 2] = [Bare::Popular, Bare::Certain];
const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tКино\t\t5200000\tцой
artist\tЗвери\t\t2300000\t
artist\tThe Weeknd\t\t92000000\tуикенд
artist\tBillie Eilish\t\t85000000\tбилли айлиш
artist\tКороль и Шут\t\t3200000\t
artist\tDrake\t\t78000000\tдрейк
artist\tMiyagi & Эндшпиль\t\t6000000\tмияги
artist\tДорадура\t\t60000\t
artist\tЗвери Леса\t\t6000\t
artist\tСкриптонид\t\t3000\t
artist\tКинолента\t\t9000\t
artist\tScriptonite Tribute\t\t12000\t
artist\tКороль и Шут Tribute\t\t7000\t
artist\tWeeknd Karaoke\t\t20000\t
artist\tBillie Eilish Piano\t\t30000\t
track\tПритон\tСкриптонит\t4000000\t
track\tПритон\tДорадура\t7000\t
track\tПритон\tScriptonite Tribute\t9000\t
track\tКукушка\tКино\t5000000\t
track\tКукушка\tЗвери Леса\t8000\t
track\tMinor\tMiyagi & Эндшпиль\t9000000\tминор
track\tМинор\tСкриптонид\t1000\t
track\tГруппа крови\tКино\t4000000\t
track\tГруппа крови\tКинолента\t7000\t
track\tЛесник\tКороль и Шут\t4500000\t
track\tЛесник\tКороль и Шут Tribute\t9000\t
track\tBlinding Lights\tThe Weeknd\t90000000\tблайндинг лайтс
track\tBlinding Lights\tWeeknd Karaoke\t60000\t
track\tLovely\tBillie Eilish\t50000000\tлавли
track\tLovely\tBillie Eilish Piano\t18000\t
track\tOne Dance\tDrake\t55000000\t
track\tСинева\tНикто\t500\t
";

fn heard(text: &str, bare: Bare) -> String {
    let catalog = FixtureCatalog::from_tsv(ROWS, true);
    let steps = interpret(text, &catalog, &Boosts::none(), bare, &Names::default());
    assert_eq!(steps.len(), 1, "{text}");
    told(&steps[0])
}

fn told(outcome: &Outcome) -> String {
    match &outcome.decision {
        Some(Decision::Act { pick }) if outcome.acts() => pick.entity.label(),
        Some(Decision::Ask { first, .. }) => format!("{}?", first.entity.label()),
        _ => outcome.intent.name().to_string(),
    }
}

fn plays(rows: &[(&str, &str)]) {
    for bare in BOTH {
        for (text, want) in rows {
            assert_eq!(heard(text, bare), *want, "{text} {bare:?}");
        }
    }
}

#[test]
fn a_known_title_said_with_the_artist_of_another_version_plays_that_version() {
    plays(&[
        ("притон дорадура", "Дорадура - Притон"),
        ("кукушка звери леса", "Звери Леса - Кукушка"),
        ("минор скриптонид", "Скриптонид - Минор"),
        ("группа крови кинолента", "Кинолента - Группа крови"),
        ("притон скриптонит", "Скриптонит - Притон"),
        ("кукушка кино", "Кино - Кукушка"),
    ]);
    for bare in BOTH {
        assert_eq!(heard("никто синева", bare), "none");
        assert_eq!(heard("звери леса", bare), "none");
    }
}

#[test]
fn a_word_naming_the_version_picks_that_version() {
    plays(&[
        (
            "блайндинг лайтс караоке",
            "Weeknd Karaoke - Blinding Lights",
        ),
        ("лавли билли айлиш пиано", "Billie Eilish Piano - Lovely"),
        ("притон скриптонит трибьют", "Scriptonite Tribute - Притон"),
        (
            "лесник король и шут трибьют",
            "Король и Шут Tribute - Лесник",
        ),
        ("лавли билли айлиш", "Billie Eilish - Lovely"),
        ("лесник король и шут", "Король и Шут - Лесник"),
    ]);
    assert_eq!(
        heard("блайндинг лайтс", Bare::Popular),
        "The Weeknd - Blinding Lights"
    );
}
