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
        (
            "перемотай на минуту нет на две вперёд",
            Intent::SeekForward,
            120,
        ),
        (
            "перемотай на минуту тридцать ой нет на две тридцать",
            Intent::SeekTo,
            150,
        ),
        (
            "перемотай на минуту тридцать нет на сорок",
            Intent::SeekTo,
            100,
        ),
        (
            "прыгни на одну минуту двадцать секунд нет на две сорок",
            Intent::SeekTo,
            160,
        ),
        (
            "вперёд на двадцать секунд ой на тридцать назад",
            Intent::SeekBackward,
            30,
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
        "включи кино нет это не то",
        "включи кино нет не та песня",
        "следующий а нет это не то",
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
    let p = one("громче нет на двадцать");
    assert_eq!((p.intent, p.number), (Intent::VolumeUp, Some(20)));
    let p = one("громкость тридцать нет сорок процентов нет лучше половину");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(50)));
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
    assert_eq!(steps("нет не это а следующую"), ["next"]);
    let p = one("не не кино");
    assert!(!p.bare);
    assert_eq!(p.intent, Intent::None);
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
    assert_eq!(
        steps("не переключай просто эта песня мне нравится"),
        ["none"]
    );
}

#[test]
fn a_command_after_a_denied_request_stands() {
    assert_eq!(steps("я не просил паузу включи обратно"), ["resume"]);
    assert_eq!(steps("я не просила следующую верни ту песню"), ["previous"]);
    assert_eq!(
        steps("я не говорил перемешивать выключи перемешивание"),
        ["shuffle_off"]
    );
    assert_eq!(steps("я не просил паузу"), ["none"]);
    assert_eq!(steps("я не говорила включи я сказала подожди"), ["none"]);
    assert_ne!(steps("он не сказал что включить"), ["resume"]);
}

#[test]
fn the_same_question_or_state_asked_twice_is_one_step() {
    assert_eq!(
        steps("кто это поёт вообще и как называется"),
        ["now_playing"]
    );
    assert_eq!(steps("что это играет и кто поёт"), ["now_playing"]);
    assert_eq!(steps("лайкни и поставь лайк"), ["like"]);
    assert_eq!(steps("перемешай и включи рандом"), ["shuffle_on"]);
    assert_eq!(steps("выключи перемешивание и рандом"), ["shuffle_off"]);
    assert_eq!(steps("поставь на паузу и останови"), ["pause", "stop"]);
    assert_eq!(steps("громче и ещё громче"), ["volume_up", "volume_up"]);
}

#[test]
fn a_hurry_word_after_a_link_is_not_a_second_command_or_a_name() {
    assert_eq!(steps("включи уже что-нибудь и побыстрее"), ["play_wave"]);
    assert_eq!(steps("давай что-нибудь поскорее"), ["play_wave"]);
    assert_eq!(steps("включи музыку и побыстрее"), ["play_wave"]);
    assert_eq!(steps("поставь на паузу побыстрее"), ["pause"]);
    assert_eq!(steps("следующую и поскорее"), ["next"]);
    let p = one("включи кино побыстрее");
    assert!(asks_for(&p, "кино"));
}

#[test]
fn first_and_then_put_two_names_in_order() {
    let said = read("включи сначала притон а потом цепи");
    assert_eq!(said.len(), 2);
    assert_eq!(said[0].intent, Intent::Play);
    assert!(asks_for(&said[0], "притон"));
    assert_eq!(said[1].intent, Intent::QueueAdd);
    assert!(asks_for(&said[1], "цепи"));
    let said = read("поставь сначала кино затем сплин");
    assert!(asks_for(&said[0], "кино"));
    assert!(asks_for(&said[1], "сплин"));
    assert_eq!(
        steps("сначала сделай потише потом включи сплин"),
        ["volume_down", "play"]
    );
    assert_eq!(
        steps("перемотай сначала потом следующую"),
        ["seek_to", "next"]
    );
    assert_eq!(steps("включи сначала"), ["seek_to"]);
}

#[test]
fn also_links_a_setting_to_what_is_played() {
    let said = read("включи колдплей а ещё звук на половину");
    assert_eq!(said.len(), 2);
    assert_eq!(said[0].intent, Intent::Play);
    assert!(asks_for(&said[0], "колдплей"));
    assert_eq!(
        (said[1].intent, said[1].number),
        (Intent::VolumeSet, Some(50))
    );
    assert_eq!(
        steps("поставь земфиру а ещё громкость на тридцать"),
        ["play", "volume_set"]
    );
    assert_eq!(
        steps("добавь в очередь сплин ещё звук на максимум"),
        ["queue_add", "volume_set"]
    );
    assert_eq!(steps("громче ещё громче"), ["volume_up"]);
    assert_eq!(steps("включи ещё раз"), ["resume"]);
    assert_eq!(steps("включи земфиру ещё раз"), ["play"]);
    assert_eq!(
        steps("перемотай назад и ещё раз"),
        ["seek_backward", "seek_to"]
    );
}

#[test]
fn a_queue_command_with_its_own_verb_after_a_play_command_is_a_step() {
    let said = read("включи скриптонита добавь в очередь басту и перемешай");
    assert_eq!(said.len(), 3);
    assert_eq!(said[0].intent, Intent::Play);
    assert!(asks_for(&said[0], "скриптонита"));
    assert_eq!(said[1].intent, Intent::QueueAdd);
    assert!(asks_for(&said[1], "басту"));
    assert_eq!(said[2].intent, Intent::ShuffleOn);
    let said = read("включи кино добавь в очередь сплин");
    assert_eq!(said.len(), 2);
    assert!(asks_for(&said[0], "кино"));
    assert!(asks_for(&said[1], "сплин"));
    assert_eq!(
        steps("поставь земфиру закинь в очередь монеточку и сделай погромче"),
        ["play", "queue_add", "volume_up"]
    );
    let p = one("включи скриптонита добавь в очередь");
    assert_eq!(p.intent, Intent::QueueAdd);
    assert!(asks_for(&p, "скриптонита"));
    let p = one("включи кино в очередь");
    assert_eq!(p.intent, Intent::QueueAdd);
}

#[test]
fn a_no_said_last_takes_the_command_back() {
    for text in [
        "пауза а нет",
        "следующий ой нет",
        "пауза хотя нет",
        "включи кино хотя нет",
        "включи кино а нет",
        "сделай громче а нет нет нет",
        "да да да нет нет",
    ] {
        assert_eq!(steps(text), ["none"], "{text}");
    }
    let p = one("включи сплин выхода нет");
    assert!(asks_for(&p, "сплин выхода нет"));
    let p = one("включи где нас нет");
    assert!(asks_for(&p, "где нас нет"));
}
