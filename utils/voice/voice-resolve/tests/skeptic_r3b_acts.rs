use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Decision, FixtureCatalog, Outcome, interpret};

const ROWS: &str = "kind\tname\tartist\tpopularity\taliases
artist\tСкриптонит\t\t6500000\tscriptonite
artist\tЗемфира\t\t3800000\t
artist\tКино\t\t5200000\tцой|группа кино
artist\tСтоп\t\t9000\t
artist\tПауза\t\t18000\t
artist\tМот\t\t5000000\t
artist\tДорадура\t\t60000\t
artist\tЛенинград Cover\t\t3000\t
artist\tСкриптонит Cover Band\t\t2000\t
artist\tDrake\t\t78000000\tдрейк|дрэйк
artist\tDrake Bell\t\t300000\tдрейк бэлл
artist\tDrakeo\t\t200000\t
track\tГруппа крови\tКино\t4000000\t
track\tГруппа крови\tКинолента\t7000\t
track\tКукушка\tКино\t5000000\t
track\tЦепи\tСкриптонит\t3000000\t
track\tЦепи\tМот\t600000\t
track\tХочу\tЗемфира\t3000000\t
track\tПритон\tСкриптонит\t4000000\t
track\tПритон\tДорадура\t7000\t
track\tЭкспонат\tЛенинград Cover\t5000\t
track\tГромче\tМот\t2000000\t
album\tДом с нормальными явлениями\tСкриптонит\t3000000\t
album\tДом с нормальными явлениями\tСкриптонит Cover Band\t900\t
";

fn heard(text: &str) -> Vec<String> {
    let catalog = FixtureCatalog::from_tsv(ROWS, true);
    let steps = interpret(
        text,
        &catalog,
        &Boosts::none(),
        Bare::Popular,
        &Names::default(),
    );
    steps.iter().map(told).collect()
}

fn told(outcome: &Outcome) -> String {
    match &outcome.decision {
        Some(Decision::Act { pick }) => pick.entity.label(),
        Some(Decision::Ask { first, .. }) => format!("{}?", first.entity.label()),
        _ => outcome.intent.name().to_string(),
    }
}

fn finds(rows: &[(&str, &str)]) {
    for (text, want) in rows {
        assert_eq!(heard(text), [*want], "{text}");
    }
}

#[test]
fn a_correction_made_with_okay_has_no_reading_as_one_name() {
    finds(&[
        ("включи стоп ладно играй", "resume"),
        ("включи группу стоп", "Стоп"),
        ("поставь паузу ладно продолжай", "resume"),
    ]);
}
