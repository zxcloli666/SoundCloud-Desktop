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
        ("мне нравица", "мне нравится"),
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
        "запели",
        "поит",
        "харашо",
        "команда",
    ] {
        assert_eq!(words(kept), kept, "{kept}");
    }
    assert!(names("включи дабро").contains(&"дабро".to_string()));
    assert!(names("включи том йорк").contains(&"том йорк".to_string()));
    assert!(names("включи кино група крови").contains(&"кино група крови".to_string()));
    assert_eq!(steps("мы всю дорогу слушали валеру"), ["none"]);
    assert_eq!(steps("все запели"), ["none"]);
    assert_eq!(steps("птицы запели"), ["none"]);
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
    for silent in [
        "рестартни сервер",
        "нужен рестарт",
        "после рестарта",
        "загрузи сейв",
        "где мой сейв",
    ] {
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
    for silent in ["вот он", "он даун", "он офф", "шат"] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert!(names("включи зис").contains(&"зис".to_string()));
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
        ("убери паузу между треками", "none"),
        ("отмени паузу в разговоре", "none"),
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
        ("что у меня в лайках", "none"),
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
    for silent in ["хватит орать", "не ори на меня", "чего ты орешь"]
    {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn swearing_at_the_song_asks_for_the_next_one_and_a_swear_after_a_command_is_dropped() {
    for (heard, want) in [
        ("заебала эта песня", "next"),
        ("заебал этот трек", "next"),
        ("как же заебало это", "next"),
        ("да заткнись ты нахуй", "stop"),
        ("выруби нахуй звук", "mute"),
        ("выключи нахуй", "stop"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "да ну нахуй",
        "иди нахуй",
        "он меня заебал своими вопросами",
        "заебала эта работа",
        "заебало уже все",
        "заебала",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn any_word_for_a_little_next_to_a_volume_word_is_a_small_step() {
    for (heard, want) in [
        ("убавь маленько", "volume_down"),
        ("сделай малость потише", "volume_down"),
        ("убавь капельку", "volume_down"),
        ("прибавь немножко", "volume_up"),
        ("сделай немножечко громче", "volume_up"),
        ("малехо погромче", "volume_up"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["маленько", "малость устал", "дай капельку"] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn naming_the_player_as_this_thing_adds_nothing_to_a_command() {
    for (heard, want) in [
        ("убавь звук в этой штуке", "volume_down"),
        ("сделай потише в этой штуковине", "volume_down"),
        ("поставь на паузу в плеере", "pause"),
        ("выключи звук в этой штуке", "mute"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "что это за штука",
        "в этой штуке",
        "я в этой штуке не разбираюсь",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn an_endearment_in_a_question_to_the_assistant_is_not_part_of_the_question() {
    for (heard, want) in [
        ("что ты вообще можешь милая", "help"),
        ("что ты умеешь дорогая", "help"),
        ("подруга какие у тебя есть команды", "help"),
        ("что сейчас играет милая", "now_playing"),
        ("как называется эта песня красавица", "now_playing"),
        ("детка кто это поет", "now_playing"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "милая",
        "тише милая",
        "помоги милая",
        "ты что милая",
        "кто это милая",
        "это любовь детка",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(steps("включи милая"), ["play"]);
    assert!(names("включи милая").contains(&"милая".to_string()));
}

#[test]
fn asking_about_the_melody_is_asking_what_plays() {
    for heard in [
        "какая это мелодия играет скажи пожалуйста",
        "какая мелодия играет",
        "что за мелодия",
        "как называется эта мелодия",
    ] {
        assert_eq!(steps(heard), ["now_playing"], "{heard}");
    }
    for silent in ["красивая мелодия", "мелодия", "мелодия дождя"]
    {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn playing_in_a_circle_is_repeat() {
    for (heard, want) in [
        ("крути по кругу весь плейлист", "repeat_all"),
        ("гоняй эту песню по кругу", "repeat_one"),
        ("включи по кругу", "repeat_one"),
        ("по кругу всё", "repeat_all"),
        ("хватит по кругу", "repeat_off"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "мы ходим по кругу",
        "бег по кругу",
        "по кругу",
        "крути педали",
        "гоняй мяч",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(steps("включи песню по кругу"), ["play"]);
    assert_eq!(steps("давай по кругу"), ["play"]);
}

#[test]
fn a_wish_that_it_played_is_a_request_to_play() {
    for (heard, want) in [
        ("сделай пожалуйста чтобы играло", "resume"),
        ("хочу чтобы играло", "resume"),
        ("надо чтоб заиграло", "resume"),
        ("сделай чтобы играла музыка", "play_wave"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "я хотел чтобы она играла на пианино",
        "она играла на пианино",
        "играло и играло",
        "чтобы играло",
        "чтоб играла музыка",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(words("что там играло"), "что там играло");
}

#[test]
fn giving_back_the_song_that_was_before_this_one_is_previous() {
    for heard in [
        "а ну ка верни ту песню что была до этого",
        "верни трек который был перед этим",
        "верни ту что играла раньше",
        "верни песню которая была",
    ] {
        assert_eq!(steps(heard), ["previous"], "{heard}");
    }
    for silent in [
        "верни ту книгу что была у меня",
        "верни деньги",
        "она была до этого",
        "что была до этого",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn rude_and_roundabout_english_is_read_like_its_russian_counterpart() {
    for (heard, want) in [
        ("skip this shit", "next"),
        ("skip this fucking song", "next"),
        ("stop this crap", "stop"),
        ("i can't hear anything", "volume_up"),
        ("i can barely hear it", "volume_up"),
        ("can't hear the music", "volume_up"),
        ("shut up", "stop"),
        ("just shut the fuck up", "stop"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["shut the door", "shut down", "what the shit"] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(steps("i can't hear my neighbours"), ["play"]);
}

#[test]
fn a_clipped_next_or_previous_before_a_track_word_is_the_full_word() {
    for (heard, want) in [
        ("след трек", "next"),
        ("след песню", "next"),
        ("включи след трек", "next"),
        ("давай след песню", "next"),
        ("пред трек", "previous"),
        ("пред песню верни", "previous"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["след", "след в след", "оставил след", "пред"] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(words("включи след"), "включи след");
    assert_eq!(words("включи трек след"), "включи трек след");
}

#[test]
fn a_hiccup_or_a_cough_around_a_command_is_noise() {
    for (heard, want) in [
        ("сделай по громче ик", "volume_up"),
        ("ик пауза", "pause"),
        ("следующий кхм", "next"),
        ("стоп кхе кхе", "stop"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["ик", "кхм кхм", "ик ик ик"] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn a_random_order_in_any_form_is_shuffle_and_playing_in_order_ends_it() {
    for (heard, want) in [
        ("отключи случайны порядок", "shuffle_off"),
        ("выключи случайный порядок", "shuffle_off"),
        ("включи случайный порядок", "shuffle_on"),
        ("играй случайным порядком", "shuffle_on"),
        ("хватит мешать играй по порядку", "shuffle_off"),
        ("играй по порядку", "shuffle_off"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in [
        "хватит мешать",
        "не мешай",
        "наведи порядок",
        "случайный прохожий",
        "все в порядке",
    ] {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
}

#[test]
fn a_swear_that_reads_as_a_complaint_counts_only_when_said_of_this_or_the_music() {
    for (heard, want) in [
        ("нахуй эту песню", "next"),
        ("заебала эта песня", "next"),
        ("как же заебало это", "next"),
        ("выключи нахуй", "stop"),
    ] {
        assert_eq!(steps(heard), [want], "{heard}");
    }
    for silent in ["да ну нахуй", "иди нахуй", "заебала", "заебало уже все"]
    {
        assert_eq!(steps(silent), ["none"], "{silent}");
    }
    assert_eq!(words("нахуй эту песню"), "нахер эту песню");
    assert_eq!(words("заебала эта песня"), "надоела эта песня");
}
