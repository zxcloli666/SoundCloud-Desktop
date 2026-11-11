use voice_nlu::{Intent, Names, Parsed, normalize, parse};

fn words(text: &str) -> String {
    normalize(text).text
}

fn steps(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
}

fn intents(text: &str) -> Vec<Intent> {
    steps(text).iter().map(|step| step.intent).collect()
}

#[test]
fn a_swear_word_is_read_for_what_it_stands_for() {
    let heard = [
        ("сука громче сделай", "громче сделай"),
        ("блять сука пиздец включи кино", "включи кино"),
        ("бляяя ну охуеть включи кино", "включи кино"),
        ("переключи блять эту хуйню", "переключи эту херню"),
        ("выключи это говно", "выключи это херню"),
        ("нихуя не слышно", "ничего не слышно"),
        ("ни хуя не слышно", "ничего не слышно"),
        ("ни хрена не слышно", "ничего не слышно"),
        ("дохуя громко", "очень громко"),
        ("заебала эта песня", "надоела эта песня"),
        ("нахуй эту песню", "нахер эту песню"),
        ("включи сукачева", "включи сукачева"),
        ("включи хулио иглесиаса", "включи хулио иглесиаса"),
    ];
    for (text, plain) in heard {
        assert_eq!(words(text), plain, "{text}");
    }
    let asked = [
        ("переключи блять эту хуйню", Intent::Next),
        ("выключи нахуй", Intent::Stop),
        ("нахуй эту песню", Intent::Next),
        ("заебала эта песня", Intent::Next),
        ("сука громче сделай", Intent::VolumeUp),
        ("нихуя не слышно", Intent::VolumeUp),
        ("дохуя громко", Intent::VolumeDown),
        ("ёб твою мать выключи", Intent::Stop),
    ];
    for (text, intent) in asked {
        assert_eq!(intents(text), [intent], "{text}");
    }
}

#[test]
fn a_word_said_again_around_an_interjection_is_said_once() {
    let cases = [
        ("следующую сука следующую", Intent::Next),
        ("дальше блять дальше", Intent::Next),
        ("следующую ну следующую", Intent::Next),
        ("громче э громче", Intent::VolumeUp),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    assert_eq!(words("следующую сука следующую"), "следующую");
}

#[test]
fn street_padding_around_a_command_is_left_out() {
    let cases = [
        ("э слышь убавь звук в натуре", Intent::VolumeDown),
        ("в натуре сделай потише", Intent::VolumeDown),
        ("слышь убавь звук по-братски", Intent::VolumeDown),
        ("ну ё моё опять эта песня дальше давай", Intent::Next),
        ("ёлки-палки выключи", Intent::Stop),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
}

#[test]
fn a_word_of_hurry_is_not_part_of_the_command() {
    let cases = [
        ("лоля выключи немедленно музыку", Intent::Stop),
        ("срочно поставь на паузу", Intent::Pause),
        ("живо переключи", Intent::Next),
        ("сделай немедленно потише", Intent::VolumeDown),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let named = &steps("включи немедленно кино")[0];
    assert_eq!(named.intent, Intent::Play);
    let said = |q: &&voice_nlu::Variant| !q.kept_fillers;
    assert!(named.queries.iter().filter(said).all(|q| q.text == "кино"));
}

#[test]
fn every_form_of_a_switch_off_verb_stops_or_turns_a_mode_off() {
    let cases = [
        ("выключай", Intent::Stop),
        ("всё хватит выключай", Intent::Stop),
        ("выключай музыку", Intent::Stop),
        ("хватит выключай", Intent::Stop),
        ("стоп выключи музыку", Intent::Stop),
        ("выруби повтор", Intent::RepeatOff),
        ("вырубай повтор", Intent::RepeatOff),
        ("выключай повтор", Intent::RepeatOff),
        ("выруби перемешивание", Intent::ShuffleOff),
        ("выключай перемешивание", Intent::ShuffleOff),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    assert_eq!(intents("не выключай"), [Intent::None]);
}

#[test]
fn a_pronoun_after_a_preposition_points_at_the_current_track() {
    let cases = [
        ("убери с него лайк", Intent::Unlike),
        ("сними с неё лайк", Intent::Unlike),
        ("убери с этой песни лайк", Intent::Unlike),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
}

#[test]
fn bringing_the_track_back_by_a_time_seeks_backward() {
    let cases = [
        (
            "верни чуть назад секунд на пять",
            Intent::SeekBackward,
            Some(5),
        ),
        (
            "верни назад на десять секунд",
            Intent::SeekBackward,
            Some(10),
        ),
        ("верни на тридцать секунд", Intent::SeekBackward, Some(30)),
        ("верни на минуту назад", Intent::SeekBackward, Some(60)),
        ("верни назад", Intent::Previous, None),
        ("верни как было", Intent::Undo, None),
        ("верни звук", Intent::Unmute, None),
    ];
    for (text, intent, number) in cases {
        let said = steps(text);
        assert_eq!(said.len(), 1, "{text}");
        assert_eq!((said[0].intent, said[0].number), (intent, number), "{text}");
    }
}

fn acts_on_its_own(step: &Parsed) -> bool {
    !matches!(
        step.intent,
        Intent::None | Intent::Play | Intent::QueueAdd | Intent::PlaySimilar
    )
}

#[test]
fn a_command_said_after_talk_is_found() {
    let cases = [
        ("я сейчас в душ пойду сделай погромче", Intent::VolumeUp),
        ("у меня голова болит сделай потише", Intent::VolumeDown),
        ("дети спят сделай потише", Intent::VolumeDown),
        ("я на минутку отойду поставь на паузу", Intent::Pause),
        ("мне звонят поставь на паузу", Intent::Pause),
        ("мы уходим выключи музыку", Intent::Stop),
        (
            "ой подожди подожди вот это место классное верни чуть назад секунд на пять",
            Intent::SeekBackward,
        ),
        (
            "вот эта песня огонь прям в сердечко добавь её в любимые",
            Intent::Like,
        ),
        (
            "знаешь что мне этот трек вообще не нравится убери с него лайк",
            Intent::Unlike,
        ),
        (
            "мне кажется или стало слишком громко убавь немного",
            Intent::VolumeDown,
        ),
        (
            "так стоп подожди выключи музыку мне надо подумать",
            Intent::Stop,
        ),
        (
            "короче слушай я сейчас в душ пойду сделай погромче чтобы там слышно было",
            Intent::VolumeUp,
        ),
        ("мне скучно включи что-нибудь весёлое", Intent::PlayWave),
        (
            "сколько можно одно и то же выруби повтор",
            Intent::RepeatOff,
        ),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    assert_eq!(
        intents(
            "гости расходятся так что давай звук на двадцать и хватит уже этого рэпа переключи"
        ),
        [Intent::VolumeSet, Intent::Next]
    );
}

#[test]
fn a_lone_verb_after_talk_acts_only_on_talk_about_the_music() {
    let asked = [
        ("хватит уже этого рэпа переключи", Intent::Next),
        ("окей лоля спасибо хватит на сегодня выключай", Intent::Stop),
        ("достало уже переключи", Intent::Next),
        ("это не та песня переключи", Intent::Next),
        ("музыка мешает выключи", Intent::Stop),
        ("мне кажется слишком громко убавь", Intent::VolumeDown),
    ];
    for (text, intent) in asked {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let room = [
        "там суп кипит выключи",
        "там суп кипит убавь",
        "ребёнок проснулся выключи",
        "чайник свистит выключи",
        "этот сериал надоел выключи",
        "хватит болтать переключи канал",
        "я не расслышал повтори",
        "ну я не знаю давай дальше",
        "ну ладно я понял давай следующую",
    ];
    for text in room {
        assert_eq!(intents(text), [Intent::None], "{text}");
    }
}

#[test]
fn a_play_request_after_a_complaint_or_a_wish_to_listen_names_what_to_play() {
    let cases = [
        ("надоело это старьё включи кино", "кино"),
        ("задолбала эта песня поставь басту", "баста"),
        (
            "я не знаю что хочу послушать ну давай наверное нирвану что ли",
            "наверное нирвана",
        ),
        ("чего бы послушать давай сплин", "сплин"),
    ];
    for (text, name) in cases {
        let said = steps(text);
        assert_eq!(said.len(), 1, "{text}");
        assert_eq!(said[0].intent, Intent::Play, "{text}");
        assert!(said[0].queries.iter().any(|q| q.text == name), "{text}");
    }
    for text in ["я устал давай завтра", "я пошёл давай до завтра"]
    {
        assert_eq!(intents(text), [Intent::None], "{text}");
    }
}

#[test]
fn the_speaker_insisting_on_their_own_words_is_not_a_report() {
    let insisted = [
        (
            "ну что ты молчишь лоля я же сказал музыку включи",
            Intent::PlayWave,
        ),
        ("я же просила сделай потише", Intent::VolumeDown),
    ];
    for (text, intent) in insisted {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let reported = [
        "она сказала включи музыку",
        "я сказал поставь на паузу",
        "жена сказала сделай потише",
        "он крикнул давай следующую",
        "я ему говорю сделай потише а он не слышит",
        "я такой сделай потише а она ноль внимания",
        "мне мама всегда говорила сделай потише",
        "в фильме он говорит поставь на паузу",
        "я читаю инструкцию тут написано нажми стоп",
    ];
    for text in reported {
        assert!(!steps(text).iter().any(acts_on_its_own), "{text}");
    }
}

#[test]
fn talk_that_only_mentions_command_words_stays_silent() {
    let room = [
        "я вчера включил басту и уснул",
        "давай потом включим",
        "если включишь громче соседи придут",
        "я пошла в магазин выключи плиту через десять минут",
        "я не слышу телевизор сделай потише",
        "ты куда пошёл поставь на место",
        "я занята поставь чайник",
        "мы уже уходим выключи утюг",
        "мне жарко убавь отопление",
        "я за рулём переключи передачу",
        "я сейчас приду не переключай",
        "ты не туда повернул сдай назад",
        "я плохо слышу говори громче",
        "убавь огонь и перемешай а то пригорит",
        "я устал как собака после работы",
        "паузу поставь лайк поставь я сказал",
    ];
    for text in room {
        assert!(!steps(text).iter().any(acts_on_its_own), "{text}");
    }
    let named = [
        ("басту дальше поставь", "басту дальше"),
        ("тише едешь плейлист включи", "тише едешь"),
    ];
    for (text, name) in named {
        let said = steps(text);
        assert_eq!(said[0].intent, Intent::Play, "{text}");
        assert!(said[0].queries.iter().any(|q| q.text == name), "{text}");
    }
}

#[test]
fn a_ban_on_another_action_after_a_command_leaves_the_command() {
    let cases = [
        (
            "лоля я на минутку отойду поставь пока на паузу ничего не переключай",
            Intent::Pause,
        ),
        ("поставь на паузу и ничего не трогай", Intent::Pause),
        ("сделай потише только не выключай", Intent::VolumeDown),
        ("включи кино и больше ничего не трогай", Intent::Play),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let taken_back = [
        "поставь на паузу не надо",
        "переключи не переключай",
        "сделай потише не делай потише",
        "не трогай",
    ];
    for text in taken_back {
        assert_eq!(intents(text), [Intent::None], "{text}");
    }
}

#[test]
fn a_nudge_or_a_complaint_after_a_command_is_a_remark() {
    let cases = [
        ("продолжай чё встала", Intent::Resume),
        ("переключи чего ждёшь", Intent::Next),
        ("выключи что ты молчишь", Intent::Stop),
        ("переключи надоела эта песня", Intent::Next),
        ("сделай потише достало уже", Intent::VolumeDown),
        ("верни как было я случайно", Intent::Undo),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let object = [
        "выключи музыку и свет",
        "повтори что ты сказала",
        "повтори ещё раз что ты сказал",
    ];
    for text in object {
        assert!(!steps(text).iter().any(acts_on_its_own), "{text}");
    }
}

#[test]
fn the_same_request_said_in_two_ways_is_one_command() {
    let cases = [
        ("сука громче сделай нихуя не слышно", Intent::VolumeUp),
        ("сделай потише слишком громко", Intent::VolumeDown),
        ("убавь звук оглохнуть можно", Intent::VolumeDown),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
}

#[test]
fn a_reason_after_a_request_for_any_music_is_not_a_name() {
    let cases = [
        "слушай лоля я тут устал как собака после работы включи пожалуйста что-нибудь спокойное а то голова раскалывается",
        "включи что-нибудь спокойное а то голова раскалывается",
        "включи музыку а то скучно",
        "поставь что-нибудь весёлое чтобы не уснуть",
    ];
    for text in cases {
        assert_eq!(intents(text), [Intent::PlayWave], "{text}");
    }
    let named = &steps("включи музыку то что вчера играло")[0];
    assert_eq!(named.intent, Intent::Play);
}

#[test]
fn having_no_strength_left_is_a_complaint_not_a_correction() {
    let cases = [
        (
            "так ладно хватит этого нытья давай следующую уже сил нет это слушать",
            Intent::Next,
        ),
        ("давай следующую сил нет это слушать", Intent::Next),
        ("переключи сил моих больше нет", Intent::Next),
        ("нет сил это слушать выключи музыку", Intent::Stop),
    ];
    for (text, intent) in cases {
        assert_eq!(intents(text), [intent], "{text}");
    }
    let corrected = &steps("включи кино нет лучше пикник")[0];
    assert!(corrected.queries.iter().any(|q| q.text == "пикник"));
    assert!(corrected.queries.iter().all(|q| !q.text.contains("кино")));
}

#[test]
fn a_play_request_replaces_the_complaint_before_it() {
    let text = "ой всё надоело это старьё лоля включи мне пожалуйста макса коржа малый повзрослел и больше ничего не трогай";
    let said = steps(text);
    assert_eq!(said.len(), 1);
    assert_eq!(said[0].intent, Intent::Play);
    let name = "макс корж малый повзрослел";
    assert!(said[0].queries.iter().any(|q| q.text == name));
}

fn asks_for(step: &Parsed, name: &str) -> bool {
    step.queries.iter().any(|q| q.text == name)
}

#[test]
fn the_listener_after_a_play_verb_does_not_start_a_remark() {
    let cases = [
        (
            "а после этого включи мне пожалуйста экспонат ленинграда",
            Intent::QueueAdd,
            "экспонат ленинграда",
        ),
        (
            "после этого поставь нам кукушку",
            Intent::QueueAdd,
            "кукушка",
        ),
        ("потом включи мне сплин", Intent::QueueAdd, "сплин"),
    ];
    for (text, intent, name) in cases {
        let said = steps(text);
        assert_eq!(said.len(), 1, "{text}");
        assert_eq!(said[0].intent, intent, "{text}");
        assert!(asks_for(&said[0], name), "{text}");
    }
    let remarked = [
        ("выключи музыку мне надо подумать", Intent::Stop),
        ("поставь на паузу мне звонят", Intent::Pause),
    ];
    for (text, intent) in remarked {
        assert_eq!(intents(text), [intent], "{text}");
    }
}
