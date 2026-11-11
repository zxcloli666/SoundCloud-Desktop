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

#[test]
fn the_new_version_is_read_the_way_a_whole_phrase_is() {
    assert_eq!(
        steps("поставь на паузу нет сделай потише и переключи"),
        ["volume_down", "next"]
    );
    assert_eq!(
        steps("включи кино нет поставь на паузу и сделай тише"),
        ["pause", "volume_down"]
    );
    assert_eq!(steps("пауза ой следующий я хотел сказать"), ["next"]);
    assert_eq!(steps("громче нет тише я сказал"), ["volume_down"]);
    assert_eq!(
        steps("лайкни нет лучше перемешай и поставь на повтор"),
        ["shuffle_on", "repeat_one"]
    );
    assert_ne!(steps("включи а нет погоди я сам"), ["pause"]);
    assert_eq!(
        steps("включи цоя ой нет то есть звери и громче"),
        ["play", "volume_up"]
    );
    assert_eq!(steps("следующий нет погоди предыдущий"), ["previous"]);
}

#[test]
fn the_new_version_may_open_by_rejecting_the_first_one() {
    let p = one("в ключи кино ой нет не кино сплин давай");
    assert_eq!(p.intent, Intent::Play);
    assert!(asks_for(&p, "сплин"));
    assert!(!mentions(&p, "кино"));
    let p = one("добавь в очередь цепи нет не цепи притон");
    assert_eq!(p.intent, Intent::QueueAdd);
    assert!(asks_for(&p, "притон"));
    assert!(!mentions(&p, "цепи"));
    let p = one("включи басту нет не басту скриптонита");
    assert!(asks_for(&p, "скриптонита"));
    let p = one("включи имэджин драгонс нет не их билли айлиш");
    assert!(asks_for(&p, "билли айлиш"));
    let p = one("включи кино нет не то сплин");
    assert!(asks_for(&p, "сплин"));
    assert_eq!(
        steps("выключи нет не выключай просто на паузу поставь"),
        ["pause"]
    );
    assert_eq!(
        steps("поставь на паузу нет не так сделай потише и переключи"),
        ["volume_down", "next"]
    );
    assert_eq!(steps("сделай громче нет не так громко"), ["volume_down"]);
    assert_eq!(steps("ой не то"), ["next"]);
}

#[test]
fn a_rejection_with_nothing_after_it_takes_the_command_back() {
    for text in [
        "включи басту то есть нет не включай",
        "лайкни нет не лайкай",
        "включи кино нет не кино",
        "следующий ой нет не то",
        "перемешай а нет не перемешивай",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn a_name_said_with_a_weak_verb_stays_under_the_first_verb() {
    let p = one("добавь в очередь цепи нет притон давай");
    assert_eq!(p.intent, Intent::QueueAdd);
    assert!(asks_for(&p, "притон"));
    let p = one("добавь в очередь басту нет хочу скриптонита");
    assert_eq!(p.intent, Intent::QueueAdd);
    assert!(asks_for(&p, "скриптонита"));
}

#[test]
fn a_correction_that_leaves_things_as_they_are_does_nothing() {
    for text in [
        "следующую стой нет оставь эту",
        "поставь на паузу а нет нет пусть играет",
        "выключи а нет пусть будет",
        "громче нет оставь как есть",
        "следующий а нет оставь",
        "включи кино нет пусть играет это",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
    assert_eq!(steps("нет оставь как было"), ["undo"]);
}

#[test]
fn a_refusal_in_the_new_version_takes_the_command_back() {
    for text in [
        "лайкни ой нет это не та песня не лайкай",
        "включи басту хотя нет не надо",
        "следующий нет стой не переключай",
        "поставь на паузу то есть нет не ставь",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

#[test]
fn a_command_taken_back_for_words_that_are_not_understood_is_not_done() {
    for text in [
        "поставь на паузу нет ну его",
        "следующий то есть этот самый",
        "выключи звук нет фигня какая то",
        "перемешай хотя нет пусть по порядку идет",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
    assert_eq!(steps("сделай потише ой голова болит"), ["volume_down"]);
    assert_eq!(steps("пауза ой звонят"), ["pause"]);
}

#[test]
fn a_turned_down_alternative_gives_way_to_the_one_said_after_it() {
    let p = one("включи кукушку только не кино а гагариной");
    assert_eq!(p.intent, Intent::Play);
    assert!(asks_for(&p, "кукушку гагариной"));
    assert!(!mentions(&p, "кино"));
    let p = one("давай земфиру только не хочу а искала");
    assert!(asks_for(&p, "земфиру искала"));
    let p = one("включи не кино а сплин");
    assert!(asks_for(&p, "сплин"));
    assert!(!mentions(&p, "кино"));
    assert_eq!(steps("поставь не на паузу а на повтор"), ["repeat_one"]);
    assert_eq!(steps("я сказал не громче а тише"), ["volume_down"]);
    assert_eq!(steps("да не выключай а потише сделай"), ["volume_down"]);
    assert_eq!(
        steps("ну я же говорю не следующий а предыдущий"),
        ["previous"]
    );
    let p = one("включи лесника а не куклу колдуна");
    assert!(asks_for(&p, "лесника"));
    assert_eq!(
        steps("поставь на паузу и не лайкай а то надоело"),
        ["pause"]
    );
}

#[test]
fn a_command_after_a_run_of_no_stands() {
    assert_eq!(steps("не не не верни как было"), ["undo"]);
    assert_eq!(steps("нет нет нет следующий"), ["next"]);
    assert_eq!(steps("не не не громче сделай"), ["volume_up"]);
    assert_eq!(steps("не не включай"), ["none"]);
    assert_eq!(steps("не не не"), ["none"]);
    assert_eq!(steps("не-не оставь"), ["none"]);
}

#[test]
fn what_to_do_instead_of_a_refused_command_is_done() {
    assert_eq!(
        steps("да не выключай ты совсем просто потише сделай"),
        ["volume_down"]
    );
    assert_eq!(steps("не переключай просто сделай тише"), ["volume_down"]);
    assert_eq!(steps("не надо паузу просто убавь звук"), ["volume_down"]);
    assert_eq!(steps("не выключай просто так"), ["none"]);
    assert_eq!(steps("да не лайкай ты всё подряд"), ["none"]);
}
