use voice_nlu::{Names, normalize};

fn words(text: &str) -> String {
    normalize(text).text
}

fn steps(text: &str) -> Vec<&'static str> {
    voice_nlu::parse(text, &Names::default())
        .iter()
        .map(|p| p.intent.name())
        .collect()
}

fn names(text: &str) -> Vec<String> {
    let parsed = voice_nlu::parse(text, &Names::default()).remove(0);
    parsed.queries.into_iter().map(|q| q.text).collect()
}

#[test]
fn a_command_word_spelled_by_ear_is_read_as_the_word() {
    for (heard, meant) in [
        ("што это за трэк", "что это за трек"),
        ("штобы было громче", "чтобы было громче"),
        ("называеца", "называется"),
        ("называецца", "называется"),
        ("какие есть каманды", "какие есть команды"),
        ("добавь в избраное", "добавь в избранное"),
        ("в очереть", "в очередь"),
        ("следущим поставь", "следующим поставь"),
        ("астанави музыку", "останови музыку"),
        ("астановись", "остановись"),
        ("мою валну", "мою волну"),
        ("рекомендацыи", "рекомендации"),
        ("паставь мои трэки", "поставь мои треки"),
        ("прадолжи", "продолжи"),
        ("пиримотай назат", "перемотай назад"),
        ("грамче", "громче"),
        ("тишы", "тиши"),
        ("плэй", "play"),
        ("рипит", "repeat"),
        ("нэкст", "next"),
    ] {
        assert_eq!(words(heard), meant, "{heard}");
    }
    for (heard, want) in [
        ("што это за трэк", "now_playing"),
        ("как называеца эта песня", "now_playing"),
        ("какие есть каманды", "help"),
        ("добавь в избраное", "like"),
        ("в очереть поставь земфиру", "queue_add"),
        ("следущим поставь сплин орбит бес сахара", "queue_add"),
        ("поставь на рипит", "repeat_one"),
        ("убери рипит", "repeat_off"),
        ("астанави музыку", "stop"),
        ("плэй", "resume"),
        ("поставь мои трэки", "play_likes"),
        ("за пусти мою валну", "play_wave"),
        ("рекомендацыи включи", "play_wave"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
}

#[test]
fn a_word_that_only_resembles_a_command_word_is_left_as_heard() {
    for kept in [
        "дабро",
        "стили",
        "том йорк",
        "оф",
        "мая",
        "любимая",
        "включит",
        "валера",
        "громка",
        "група крови",
    ] {
        assert_eq!(words(kept), kept, "{kept}");
    }
    assert!(names("включи дабро").contains(&"дабро".to_string()));
    assert!(names("включи том йорк").contains(&"том йорк".to_string()));
    assert!(names("включи кино група крови").contains(&"кино група крови".to_string()));
    assert_eq!(steps("мы всю дорогу слушали валеру"), ["none"]);
}

#[test]
fn two_command_words_run_together_or_one_cut_in_two_are_read_apart_and_whole() {
    for (heard, meant) in [
        ("сделайпотише", "сделай потише"),
        ("сделайгромче", "сделай громче"),
        ("следующийтрек", "следующий трек"),
        ("кто это по ёт", "кто это поет"),
        ("сделай по громче", "сделай погромче"),
        ("за пусти", "запусти"),
        ("в ключи чтонибудь", "включи чтонибудь"),
    ] {
        assert_eq!(words(heard), meant, "{heard}");
    }
    for (heard, want) in [
        ("сделайпотише", "volume_down"),
        ("следующийтрек", "next"),
        ("кто это по ёт", "now_playing"),
        ("кто по ёт", "now_playing"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for kept in [
        "плейстейшен",
        "радиохед",
        "скриптонит",
        "стопхам",
        "звукорежиссер",
    ] {
        assert_eq!(words(kept), kept, "{kept}");
    }
}

#[test]
fn a_loan_verb_keeps_its_meaning_under_russian_prefixes_and_endings() {
    for (heard, want) in [
        ("зашафли плейлист", "shuffle_on"),
        ("зашафль", "shuffle_on"),
        ("шафлани", "shuffle_on"),
        ("замьють звук", "mute"),
        ("замьють нахрен", "mute"),
        ("замьюти", "mute"),
        ("мьютани", "mute"),
        ("зарепить этот трек", "repeat_one"),
        ("анлайкни", "unlike"),
        ("анлайкнуть этот трек", "unlike"),
        ("рестартни трек", "seek_to"),
        ("рестартани", "seek_to"),
        ("рестартуй песню", "seek_to"),
        ("сейвни в лайки", "like"),
        ("сейвани", "like"),
        ("засейвь трек", "like"),
        ("плэйни", "resume"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["рестартни сервер", "загрузи сейв", "где мой сейв"]
    {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(steps("замути что нибудь"), ["play_wave"]);
}

#[test]
fn english_command_words_written_in_cyrillic_are_read_as_english() {
    for (heard, meant) in [
        ("плиз стоп зе мьюзик", "стоп the music"),
        ("плей май лайкс", "play my likes"),
        ("тёрн ит ап", "turn it up"),
        ("вольюм даун", "volume down"),
        ("рипит офф", "repeat off"),
        ("репит он", "repeat on"),
        ("вот из зис сонг", "what is this song"),
        ("вотс плейинг нау", "whats playing now"),
        ("скип зис сонг", "skip this song"),
        ("хелп ми что ты умеешь", "help me что ты умеешь"),
    ] {
        assert_eq!(words(heard), meant, "{heard}");
    }
    for (heard, want) in [
        ("плиз стоп зе мьюзик", "stop"),
        ("плей май лайкс", "play_likes"),
        ("тёрн ит ап", "volume_up"),
        ("вольюм даун", "volume_down"),
        ("рипит офф", "repeat_off"),
        ("вот из зис сонг", "now_playing"),
        ("вотс плейинг нау", "now_playing"),
        ("хелп ми что ты умеешь", "help"),
        ("скип зис сонг", "next"),
        ("мьют ит", "mute"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
}

#[test]
fn a_russian_word_that_sounds_english_stays_russian_among_russian_words() {
    for kept in [
        "вот он",
        "вот это трек",
        "включи ласковый май",
        "включи шейп оф ю",
        "включи нау",
        "из плейлиста включи",
        "он из москвы",
        "ту песню включи",
    ] {
        assert_eq!(words(kept), kept, "{kept}");
    }
    assert_eq!(words("вот скип"), "вот skip");
    assert_eq!(words("плей ласковый май"), "play ласковый май");
    assert_eq!(steps("вот скип"), ["next"]);
    assert_eq!(steps("вот он"), ["none"]);
    assert_eq!(steps("он даун"), ["none"]);
}

#[test]
fn ukrainian_and_belarusian_command_words_are_read_as_their_russian_forms() {
    for (heard, want) in [
        ("що це грає", "now_playing"),
        ("што зараз грае", "now_playing"),
        ("хто це співає", "now_playing"),
        ("якая гэта песня", "now_playing"),
        ("цяпер што грае", "now_playing"),
        ("та выключи ты цю музыку", "stop"),
        ("зупини музику", "stop"),
        ("спыни гэту песню", "stop"),
        ("зроби трохи тихіше", "volume_down"),
        ("зробы крыху гучней", "volume_up"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    assert_eq!(steps("я зараз приду"), ["none"]);
    assert_eq!(steps("хто там"), ["none"]);
}

#[test]
fn a_verb_that_takes_a_state_away_turns_it_off() {
    for (heard, want) in [
        ("отжми паузу", "resume"),
        ("отожми паузу", "resume"),
        ("сними с паузы", "resume"),
        ("убери паузу", "resume"),
        ("отмени паузу", "resume"),
        ("выключи паузу", "resume"),
        ("сними с повтора", "repeat_off"),
        ("сними повтор", "repeat_off"),
        ("выруби повтор", "repeat_off"),
        ("убери рипит", "repeat_off"),
        ("отмени повтор", "repeat_off"),
        ("выруби рандом", "shuffle_off"),
        ("вырубай перемешивание", "shuffle_off"),
        ("сними шафл", "shuffle_off"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for (heard, want) in [
        ("поставь на паузу", "pause"),
        ("поставь на повтор", "repeat_one"),
        ("поставь на рипит", "repeat_one"),
        ("включи рандом", "shuffle_on"),
        ("сними", "none"),
        ("выруби свет", "none"),
        ("сними трубку", "none"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
}

#[test]
fn a_throw_into_the_favourites_is_a_like() {
    for heard in [
        "кинь в любимые",
        "закинь в избранное",
        "кинь в лайки",
        "добавь в лайки",
        "кинь этот трек в любимые",
        "закинь песню в избранное",
    ] {
        assert_eq!(steps(heard), ["like"], "{heard}");
    }
    for (heard, want) in [
        ("включи любимые", "play_likes"),
        ("кинь любимые", "play_likes"),
        ("включи из избранного", "play_likes"),
        ("включи мои лайки", "play_likes"),
        ("кинь в очередь земфиру", "queue_add"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
}

#[test]
fn giving_back_how_it_was_or_rolling_back_is_undo() {
    for heard in [
        "верни как было",
        "верни как была",
        "верни как был",
        "откати как было",
        "откати",
        "откати назад",
        "сделай откат",
    ] {
        assert_eq!(steps(heard), ["undo"], "{heard}");
    }
    for silent in ["откат системы", "как была погода", "откати машину"]
    {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn a_halting_word_said_over_and_over_is_said_once() {
    for (heard, want) in [
        ("стоп стоп стоп всё хватит", "stop"),
        ("стоп стоп стоп", "stop"),
        ("хватит хватит хватит", "stop"),
        ("stop stop stop", "stop"),
        ("пауза пауза пауза", "pause"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for lyric in [
        "давай давай давай",
        "люби люби люби",
        "танцуй танцуй танцуй",
        "стоп стоп стоп не говори ничего",
        "громче громче громче",
    ] {
        assert_eq!(steps(lyric), ["none"], "{lyric}");
    }
}

#[test]
fn a_mood_or_a_manner_after_a_word_for_some_music_is_the_wave() {
    for heard in [
        "в ключи что нибудь душевное",
        "включи душевное",
        "включи чё нить по кайфу",
        "поставь что нибудь для души",
        "включи музыку для души",
        "братва врубай музон по красоте",
        "поставь что нибудь под настроение",
    ] {
        assert_eq!(steps(heard), ["play_wave"], "{heard}");
    }
    for silent in [
        "расскажи что нибудь душевное",
        "это было по красоте",
        "душевное кино",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(steps("включи по красоте"), ["play"]);
    assert_eq!(steps("включи для души"), ["play"]);
}

#[test]
fn telling_it_to_quit_the_music_is_stop() {
    for heard in [
        "завязывай с этой музыкой",
        "заканчивай с музыкой",
        "кончай эту музыку",
        "завязывай уже",
    ] {
        assert_eq!(steps(heard), ["stop"], "{heard}");
    }
    for silent in [
        "завязывай шнурки",
        "заканчивай уроки",
        "кончай болтать",
        "не завязывай",
        "не заканчивай с музыкой",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn a_complaint_that_it_yells_belongs_to_the_request_for_quieter() {
    for heard in [
        "харэ орать сделай тише",
        "хватит орать потише давай",
        "не ори сделай потише",
        "чего орешь тише",
    ] {
        assert_eq!(steps(heard), ["volume_down"], "{heard}");
    }
    for silent in [
        "хватит орать",
        "не ори на меня",
        "ори громче",
        "чего ты орешь",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}
