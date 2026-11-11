use voice_nlu::{Intent, Names, Parsed};

fn read(text: &str) -> Vec<Parsed> {
    voice_nlu::parse(text, &Names::default())
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

fn one(text: &str) -> Parsed {
    let mut said = read(text);
    assert_eq!(said.len(), 1, "{text}");
    said.remove(0)
}

fn asks_for(p: &Parsed, name: &str) -> bool {
    p.queries.iter().any(|q| q.text == name)
}

fn mentions(p: &Parsed, part: &str) -> bool {
    p.queries.iter().any(|q| q.text.contains(part))
}

#[test]
fn a_spat_out_word_starts_the_new_version() {
    let p = one("включи дрейка тьфу ты дору");
    assert_eq!(p.intent, Intent::Play);
    assert!(asks_for(&p, "дору"));
    assert!(!mentions(&p, "дрейк"));
    assert_eq!(steps("следующий тьфу предыдущий"), ["previous"]);
    assert_eq!(steps("сделай громче тьфу ты тише"), ["volume_down"]);
    let p = one("громкость на тридцать тьфу на сорок");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(40)));
}

#[test]
fn at_least_is_not_a_change_of_mind() {
    let p = one("громкость на тридцать хотя бы");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(30)));
    let p = one("громкость на двадцать а нет на сорок хотя бы");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(40)));
    assert_eq!(steps("включи хотя бы что-нибудь"), ["play_wave"]);
    assert_eq!(steps("сделай хотя бы потише"), ["volume_down"]);
    assert_eq!(steps("громче хотя нет тише"), ["volume_down"]);
}

#[test]
fn a_corrected_amount_keeps_the_action_and_the_unit() {
    for (text, intent, number) in [
        (
            "вперёд на десять нет на двадцать секунд",
            Intent::SeekForward,
            20,
        ),
        (
            "назад на десять секунд то есть на пятнадцать",
            Intent::SeekBackward,
            15,
        ),
        (
            "перемотай на минуту вперёд нет на две",
            Intent::SeekForward,
            120,
        ),
        (
            "отмотай на двадцать секунд нет на минуту",
            Intent::SeekBackward,
            60,
        ),
        (
            "перемотай на минуту тридцать ой нет на две минуты тридцать",
            Intent::SeekTo,
            150,
        ),
        (
            "громкость на двадцать процентов нет на тридцать",
            Intent::VolumeSet,
            30,
        ),
        (
            "убавь на десять процентов а нет на пять",
            Intent::VolumeDown,
            5,
        ),
    ] {
        let p = one(text);
        assert_eq!((p.intent, p.number), (intent, Some(number)), "{text}");
    }
}

#[test]
fn a_corrected_direction_keeps_the_amount() {
    for (text, intent, number) in [
        (
            "перемотай на тридцать секунд назад то есть вперёд",
            Intent::SeekForward,
            30,
        ),
        ("вперёд на минуту ой назад", Intent::SeekBackward, 60),
        (
            "перемотай на десять секунд нет назад",
            Intent::SeekBackward,
            10,
        ),
    ] {
        let p = one(text);
        assert_eq!((p.intent, p.number), (intent, Some(number)), "{text}");
    }
    assert_eq!(steps("следующий ой назад"), ["previous"]);
    assert_eq!(steps("поставь на паузу а нет дальше"), ["next"]);
    assert_eq!(steps("перемотай назад нет дальше"), ["next"]);
}

#[test]
fn a_remark_before_the_new_version_is_left_out() {
    let p = one("поставь плейлист для сна нет рано еще давай вечеринку");
    assert_eq!(p.intent, Intent::Play);
    assert!(asks_for(&p, "вечеринку"));
    assert!(!mentions(&p, "сна"));
    let p = one("включи земфиру нет слишком грустно давай монеточку");
    assert!(asks_for(&p, "монеточку"));
    assert!(!mentions(&p, "грустно"));
    let p = one("громкость на семьдесят ой много давай на тридцать");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(30)));
    assert_eq!(
        steps("следующий нет не хочу давай предыдущий"),
        ["previous"]
    );
    let p = one("включи кино нет сплин давай");
    assert!(asks_for(&p, "сплин"));
    let p = one("земфиру давай включи а не сплин");
    assert!(asks_for(&p, "земфиру"));
}
