use voice_nlu::{Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::new(&["Loli", "Лоля"]))
        .iter()
        .map(|p| p.intent.name())
        .collect()
}

fn stays_silent(phrases: &[&str]) {
    for text in phrases {
        assert_eq!(steps(text), ["none"], "{text}");
    }
}

fn acts(rows: &[(&str, &str)]) {
    for (text, want) in rows {
        assert_eq!(steps(text), [*want], "{text}");
    }
}

#[test]
fn a_whole_command_word_said_again_and_again_is_said_once() {
    acts(&[
        ("громче громче громче", "volume_up"),
        ("погромче погромче погромче", "volume_up"),
        ("тише тише тише", "volume_down"),
        ("следующий следующий следующий", "next"),
        ("следующий следующий ну следующий же", "next"),
        ("стоп ну стоп стоп", "stop"),
        ("пауза пауза пауза", "pause"),
    ]);
    stays_silent(&[
        "давай давай давай",
        "люби люби люби",
        "вперед вперед вперед",
        "дальше дальше дальше будет только хуже",
        "стоп стоп стоп не говори ничего",
        "тише тише тише дети",
    ]);
}

#[test]
fn a_thing_named_after_a_volume_step_with_the_noise_it_makes_is_the_reason() {
    acts(&[
        ("сделай громче чайник кипит", "volume_up"),
        ("сделай громче чайник свистит", "volume_up"),
        ("громче чайник кипит", "volume_up"),
        ("сделай тише телефон звонит", "volume_down"),
    ]);
    stays_silent(&[
        "сделай громче чайник",
        "сделай громче будильник",
        "сделай тише телевизор орет",
        "выключи чайник кипит",
    ]);
}

#[test]
fn not_that_opens_a_polite_request_does_not_deny_it() {
    acts(&[
        (
            "извини что отвлекаю но не мог бы ты поставить на паузу",
            "pause",
        ),
        ("но не мог бы ты сделать погромче", "volume_up"),
        ("извини но не могла бы ты включить кино", "play"),
    ]);
    stays_silent(&[
        "извини что отвлекаю но не мог бы ты выключить свет",
        "извини но не могла бы ты закрыть окно",
        "не мог бы ты не включать музыку",
        "включи кино но не мог бы ты не включать его",
    ]);
}

#[test]
fn an_order_passed_on_to_another_person_is_said_about_them() {
    stays_silent(&[
        "попроси его сделать потише",
        "попроси папу сделать потише",
        "можешь попросить его выключить музыку",
        "извини но не мог бы ты попросить его сделать потише",
    ]);
    acts(&[
        ("можно попросить тебя сделать потише", "volume_down"),
        ("можно попросить сделать потише", "volume_down"),
        ("можно попросить погромче", "volume_up"),
        ("можно попросить поставить на паузу", "pause"),
    ]);
}

#[test]
fn not_wanting_this_one_and_naming_another_asks_for_the_next() {
    acts(&[
        ("не хочу эту пусть другая будет", "next"),
        ("не хочу эту давай другую", "next"),
        ("не хочу эту хочу другую", "next"),
        ("не хочу эту песню давай другую", "next"),
    ]);
    stays_silent(&[
        "не хочу эту куртку пусть другая будет",
        "не хочу эту машину давай другую",
        "не хочу эту выключать",
        "не хочу другую",
    ]);
}

#[test]
fn a_name_glued_to_a_command_or_started_twice_is_still_the_name() {
    acts(&[
        ("лоляпауза", "pause"),
        ("лоляпотише", "volume_down"),
        ("лолюпауза", "pause"),
        ("лолявключи баста", "play"),
        ("ло лоля пауза", "pause"),
        ("lo loli pause", "pause"),
    ]);
    stays_silent(&["лолита", "лолипоп", "ло лоля"]);
    let kept = parse("включи лолиту", &Names::new(&["Лоля"]));
    assert!(kept[0].queries.iter().any(|q| q.text == "лолиту"));
}

#[test]
fn a_rude_word_inside_a_command_only_stresses_it() {
    acts(&[
        ("нахрен следующий", "next"),
        ("тише ппц", "volume_down"),
        ("давай мля следующий трек", "next"),
        ("заебал этот трек следующий", "next"),
        ("достала эта песня следующая", "next"),
    ]);
    stays_silent(&[
        "нахрен следующий урок",
        "заебал этот сосед следующий",
        "надоел этот урок следующий",
        "ппц",
        "мля",
    ]);
}

#[test]
fn a_repeat_of_all_of_them_repeats_all() {
    acts(&[
        ("повтор всех", "repeat_all"),
        ("поставь на повтор всех", "repeat_all"),
        ("повтор одного трека нет повтор всех", "repeat_all"),
    ]);
    stays_silent(&["всех", "мы повторим для всех", "повторяй за всеми"]);
}

#[test]
fn a_refusal_followed_by_a_new_order_gives_that_order() {
    acts(&[
        ("не надо играй дальше", "resume"),
        ("нет не надо выключи повтор", "repeat_off"),
        ("не выключай играй", "resume"),
        ("поставь на паузу ладно не надо играй дальше", "resume"),
        ("поставь на повтор нет не надо выключи повтор", "repeat_off"),
    ]);
    stays_silent(&[
        "не надо громче",
        "не надо выключать",
        "не надо ничего не включай",
        "включи кино нет не надо ничего не включай",
        "не надо включать телевизор выключи свет",
    ]);
}

#[test]
fn saying_the_step_taken_back_was_too_much_is_the_reason_for_the_new_one() {
    acts(&[
        ("ой погромче а нет это слишком потише", "volume_down"),
        ("погромче нет слишком громко потише", "volume_down"),
        ("потише ой нет это слишком тихо погромче", "volume_up"),
        ("громче нет это слишком громко", "volume_down"),
    ]);
    stays_silent(&[
        "погромче а нет это слишком",
        "погромче а нет это слишком мама спит",
        "потише нет это слишком",
    ]);
}

#[test]
fn a_no_right_after_a_lone_play_verb_begins_the_name() {
    let heard = parse("включи нет выхода", &Names::new(&["Лоля"]));
    assert!(
        heard[0]
            .queries
            .iter()
            .any(|q| q.text.contains("нет выхода"))
    );
    acts(&[
        ("включи нет лучше поставь на паузу", "pause"),
        ("включи нет выключи", "stop"),
    ]);
    stays_silent(&["включи нет ладно", "включи нет не надо"]);
    let named = parse("включи а нет погоди кино", &Names::new(&["Лоля"]));
    assert!(named[0].queries.iter().all(|q| !q.text.contains("нет")));
}

#[test]
fn an_english_no_takes_back_the_step_before_it() {
    acts(&[
        ("pause no wait resume", "resume"),
        ("volume down no up", "volume_up"),
        ("volume up no down", "volume_down"),
        ("turn it up no down", "volume_down"),
        ("next no previous", "previous"),
    ]);
    stays_silent(&["no", "stop no wait", "pause no"]);
    let named = parse("play no doubt", &Names::new(&["Loli"]));
    assert!(named[0].queries.iter().any(|q| q.text == "no doubt"));
}

#[test]
fn a_complaint_said_before_a_command_that_fixes_it_is_its_reason() {
    acts(&[
        ("не слышно ничего сделай громче", "volume_up"),
        ("я не слышу вообще ничего прибавь", "volume_up"),
        ("ой что то не слышно сделай громкость побольше", "volume_up"),
        ("не слышно сделай тише", "volume_down"),
    ]);
    stays_silent(&[
        "я не слышу маму выключи",
        "не слышно включи свет",
        "не слышно сделай потише телевизор",
        "не слышно что ты говоришь сделай потише",
    ]);
}

#[test]
fn a_remark_after_a_command_that_has_its_object_is_a_remark() {
    acts(&[
        ("вырубай эту музыку уши вянут", "stop"),
        ("лоля поставь на паузу митинг начался", "pause"),
        ("выключи звук ребенок спит", "mute"),
    ]);
    stays_silent(&[
        "выключи чайник кипит",
        "выключи музыку телевизор орет",
        "выключи телевизор дети спят",
        "поставь чайник гости пришли",
    ]);
}

#[test]
fn the_name_said_before_an_order_turns_the_speech_to_the_listener() {
    acts(&[
        ("тише тише дети лоля сделай потише", "volume_down"),
        ("слушай я потом тебе перезвоню Лоля выключи музыку", "stop"),
        ("дети идите спать лоля выключи музыку", "stop"),
        ("выключи свет лоля включи музыку", "play_wave"),
    ]);
    stays_silent(&[
        "мама сказала лоля выключи музыку",
        "дети тише лоля спит",
        "я лоле сказала выключи",
        "Лоля это не тебе я с мамой разговариваю",
    ]);
    let kept = parse("включи кино лоля сделай погромче", &Names::new(&["Лоля"]));
    assert!(kept[0].queries.iter().any(|q| q.text.contains("кино")));
}

#[test]
fn the_speaker_saying_they_said_it_insists_on_the_command() {
    acts(&[
        ("я же сказал тише", "volume_down"),
        ("я тебе говорю пауза", "pause"),
        ("ты слышишь я говорю пауза", "pause"),
        ("ты глухая что ли я сказал тише", "volume_down"),
    ]);
    stays_silent(&[
        "я сказал тише",
        "я говорю тише",
        "я сказала стоп а он нет продолжай",
        "я говорю маме пауза",
        "он сказал пауза",
        "я сказал ему тише",
        "мама сказала тише",
        "я сказал не громче",
    ]);
}

#[test]
fn a_hello_on_the_phone_before_a_command_checks_the_listener_hears() {
    acts(&[
        ("ало лоля ало поставь на паузу ало", "pause"),
        ("лоля лоля ты слышишь алло я говорю пауза", "pause"),
        ("алло пауза", "pause"),
    ]);
    stays_silent(&[
        "алло кто это",
        "алло мам привет",
        "алло ты где",
        "алло мама выключи телевизор",
        "алло он сказал пауза",
    ]);
}

#[test]
fn mom_called_by_her_short_name_is_someone_else_like_mom() {
    acts(&[
        ("пауза мам я перезвоню", "pause"),
        ("пауза мам", "pause"),
        ("сделай потише пап спит", "volume_down"),
    ]);
    stays_silent(&["мам сделай потише", "мам выключи телевизор", "мам пауза"]);
}

#[test]
fn a_name_reading_that_keeps_only_the_command_word_is_the_command() {
    let names = Names::new(&["Лоля"]);
    for text in [
        "дальше не эту",
        "дальше дальше не эту",
        "пауза ну пожалуйста",
    ] {
        let p = &parse(text, &names)[0];
        assert!(p.intent.is_control(), "{text}");
        assert!(p.alt.is_empty(), "{text}");
    }
    let named = &parse("группу стоп", &names)[0];
    assert!(named.alt.iter().any(|q| q.text == "стоп"));
}

#[test]
fn a_nudge_to_the_listener_after_a_command_word_only_hurries_it() {
    acts(&[
        ("назад ну назад же что непонятного", "previous"),
        ("дальше что непонятного", "next"),
        ("пауза что ты стоишь", "pause"),
        ("громче чего ты ждешь", "volume_up"),
    ]);
    stays_silent(&[
        "что непонятного",
        "мама что непонятного",
        "я не понимаю что непонятного",
        "тише что ты орешь",
    ]);
}

#[test]
fn a_kind_word_to_the_listener_after_a_command_is_only_an_address() {
    acts(&[
        ("давай другую песню милая", "next"),
        ("следующую милая", "next"),
        ("пауза дорогая", "pause"),
        ("сделай потише милая", "volume_down"),
    ]);
    stays_silent(&["милая моя", "мама дорогая", "тише милая", "громче дорогая"]);
    let titled = parse("включи песню милая", &Names::new(&["Лоля"]));
    assert!(titled[0].queries.iter().any(|q| q.text.contains("милая")));
}

#[test]
fn some_music_for_the_road_is_the_wave() {
    acts(&[
        ("лоля вруби мне в дорогу чё нибудь", "play_wave"),
        ("включи что нибудь в дорогу", "play_wave"),
        ("включи мне что нибудь для дороги", "play_wave"),
    ]);
    stays_silent(&[
        "в дорогу",
        "собери что нибудь в дорогу",
        "купи что нибудь в дорогу",
        "включи навигатор в дорогу",
    ]);
}

#[test]
fn enough_music_stops_it() {
    acts(&[
        ("достаточно музыки спасибо", "stop"),
        ("достаточно музыки на сегодня", "stop"),
        ("с меня достаточно музыки", "stop"),
    ]);
    stays_silent(&[
        "достаточно",
        "достаточно громко",
        "у меня достаточно музыки в плейлисте",
    ]);
}

#[test]
fn words_to_the_room_after_a_waver_leave_the_command_as_it_was() {
    acts(&[
        ("включи кукушку кино ой кто там", "play"),
        ("пауза ой кто там", "pause"),
        ("включи кино ой мама пришла", "play"),
        ("включи кино ой кто поет", "now_playing"),
    ]);
    stays_silent(&["пауза нет кто там", "стоп нет мама пришла", "кто там"]);
}

#[test]
fn a_time_span_said_before_a_command_tells_when_and_is_not_its_object() {
    acts(&[
        (
            "у меня тут соседи сверлят весь день сделай погромче",
            "volume_up",
        ),
        ("соседи сверлят всю ночь сделай погромче", "volume_up"),
    ]);
    stays_silent(&[
        "весь день свет выключи",
        "целый день телевизор сделай потише",
        "соседи сверлят свет выключи",
    ]);
}
