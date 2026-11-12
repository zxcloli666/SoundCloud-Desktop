use voice_nlu::{Names, parse};

fn steps(text: &str) -> Vec<&'static str> {
    parse(text, &Names::new(&["Лоля"]))
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

fn acts_in_steps(rows: &[(&str, &[&str])]) {
    for (text, want) in rows {
        assert_eq!(steps(text), *want, "{text}");
    }
}

#[test]
fn a_phrase_that_says_it_is_not_for_the_listener_is_talk() {
    stays_silent(&[
        "Лоля это не тебе я с мамой разговариваю",
        "это не тебе",
        "я не с тобой говорю",
        "не тебе говорю",
        "это я не вам",
        "не тебя спрашиваю",
    ]);
    acts(&[
        ("это не то", "next"),
        ("не это", "next"),
        ("Лоля следующий", "next"),
    ]);
}

#[test]
fn music_named_after_about_is_the_topic_of_talk() {
    stays_silent(&[
        "я тебе не про музыку",
        "я про музыку",
        "это не про музыку",
        "мы про громкость говорили",
        "я про паузу спрашивала",
    ]);
    acts(&[
        ("музыку", "play_wave"),
        ("давай музыку", "play_wave"),
        ("включи песню про любовь", "play"),
        ("сделай потише я про громкость", "volume_down"),
    ]);
}

#[test]
fn silence_said_with_a_describing_word_describes_the_room() {
    stays_silent(&[
        "ну и тишина тут",
        "тут такая тишина",
        "какая тишина",
        "тишина здесь",
        "в комнате тишина",
    ]);
    acts(&[
        ("тишина", "pause"),
        ("тишина пожалуйста", "pause"),
        ("тишину", "pause"),
        ("давай тишину", "pause"),
    ]);
}

#[test]
fn listening_planned_for_later_is_talk() {
    stays_silent(&[
        "вечером наверное послушаем земфиру",
        "завтра послушаем кино",
        "вечером послушаю земфиру",
        "наверное послушаем потом",
    ]);
    acts(&[
        ("послушаем земфиру", "play"),
        ("давай послушаем земфиру", "play"),
        ("может послушаем земфиру", "play"),
    ]);
}

#[test]
fn a_loudness_adjective_describes_a_noun_and_is_not_the_volume() {
    stays_silent(&[
        "мы же договорились без громкой музыки после десяти",
        "громкая музыка мешает спать",
        "громкий звук пугает кошку",
    ]);
    acts(&[
        ("громкость 50", "volume_set"),
        ("громкость на максимум", "volume_set"),
        ("сделай громкость 7", "volume_set"),
        ("звук громче", "volume_up"),
    ]);
}

#[test]
fn a_mute_verb_with_an_object_that_is_not_the_music_is_about_something_else() {
    stays_silent(&["заглуши мотор", "заглуши двигатель", "заглуши машину"]);
    acts(&[
        ("заглуши", "mute"),
        ("заглуши музыку", "mute"),
        ("заглуши звук", "mute"),
        ("заглуши эту песню", "mute"),
        ("заглуши его", "mute"),
        ("заглуши на минуту", "mute"),
    ]);
}

#[test]
fn a_direction_word_after_not_is_denied() {
    stays_silent(&["не смотри назад", "не назад", "не вперед", "не дальше"]);
    acts(&[
        ("назад", "previous"),
        ("не назад а вперед", "next"),
        ("перемотай назад", "seek_backward"),
    ]);
}

#[test]
fn me_right_after_a_command_verb_is_who_it_is_for_not_a_remark() {
    stays_silent(&[
        "выключи мне телевизор",
        "перемотай мне кассету в телевизоре",
    ]);
    acts(&[
        ("выключи мне музыку", "stop"),
        ("перемотай мне на минуту вперед", "seek_forward"),
        ("перемотай мне", "seek_forward"),
        ("выключи я сплю", "stop"),
    ]);
}

#[test]
fn a_tape_recorder_is_a_device_of_its_own() {
    stays_silent(&[
        "перемотай мне плёнку в видеомагнитофоне",
        "включи магнитофон",
        "перемотай кассету в видике",
    ]);
    acts(&[("включи мотылька", "play"), ("включи видеоклипы", "play")]);
}

#[test]
fn a_verb_of_repeating_in_the_present_tells_what_happens() {
    stays_silent(&[
        "ты повторяешь одно и то же",
        "она всё время повторяет",
        "опять повторяется",
    ]);
    acts(&[
        ("повтори", "repeat_one"),
        ("повторишь", "repeat_one"),
        ("повторяй", "repeat_one"),
        ("на повтор", "repeat_one"),
        ("повторить", "repeat_one"),
        ("не повторяй", "repeat_off"),
    ]);
}

#[test]
fn a_take_back_followed_only_by_fillers_takes_the_wish_back() {
    stays_silent(&[
        "может ленинград хотя нет ладно",
        "включи земфиру нет ладно",
        "может ленинград хотя нет",
    ]);
    acts(&[
        ("может ленинград хотя нет включи кино", "play"),
        ("включи земфиру ой ладно", "play"),
    ]);
}

#[test]
fn a_swear_beside_a_mute_verb_only_stresses_it() {
    acts(&[
        ("замьють нахрен", "mute"),
        ("заглуши нахрен", "mute"),
        ("заглуши нафиг эту песню", "mute"),
    ]);
    stays_silent(&["заглуши мотор"]);
}

#[test]
fn a_seek_by_zero_goes_to_the_start() {
    acts(&[
        ("перемотай на ноль", "seek_to"),
        ("перемотай на 0", "seek_to"),
        ("отмотай на ноль", "seek_to"),
        ("перемотай на 10", "seek_forward"),
        ("отмотай на 10", "seek_backward"),
        ("перемотай на 0:30", "seek_to"),
    ]);
}

#[test]
fn a_final_consonant_is_heard_without_its_voice() {
    acts(&[
        ("поставь лайг", "like"),
        ("стоб", "stop"),
        ("назат", "previous"),
        ("поставь лайк", "like"),
        ("стоп", "stop"),
        ("включи мот", "play"),
    ]);
}

#[test]
fn turn_off_said_with_a_southern_vowel_is_still_turn_off() {
    acts(&[
        ("атключи павтор", "repeat_off"),
        ("атключи звук", "mute"),
        ("отключи повтор", "repeat_off"),
        ("выключи повтор", "repeat_off"),
    ]);
}

#[test]
fn more_or_less_beside_a_volume_noun_steps_the_volume() {
    acts(&[
        ("громкость побольше", "volume_up"),
        ("звук поменьше", "volume_down"),
        ("сделай звук побольше", "volume_up"),
        ("громкость больше", "volume_up"),
        ("поставь побольше земфиры", "play"),
        ("громкость 50", "volume_set"),
    ]);
    acts_in_steps(&[("громкость побольше и следующий", &["volume_up", "next"])]);
}

#[test]
fn such_after_a_question_word_asks_what_and_not_for_something_similar() {
    acts(&[
        ("так что бы такое послушать ну вот включи кино", "play"),
        ("чего бы такого поставить включи земфиру", "play"),
        ("включи что-нибудь такое", "play_similar"),
        ("давай ещё такое", "play_similar"),
        ("включи такое же", "play_similar"),
    ]);
}

#[test]
fn okay_after_something_said_takes_it_back_for_what_follows() {
    acts(&[
        ("включи стоп ладно играй", "resume"),
        ("поставь паузу ладно продолжай", "resume"),
        ("ну ладно стоп", "stop"),
        (
            "так ладно хватит этого нытья давай следующую уже сил нет это слушать",
            "next",
        ),
        ("ладно включи земфиру", "play"),
    ]);
}

#[test]
fn a_command_taken_back_with_undo_in_the_same_breath_does_nothing() {
    stays_silent(&[
        "выключи звук нет верни обратно",
        "отключи звук нет верни обратно",
        "включи земфиру нет отмени",
    ]);
    acts(&[
        ("блин нет верни как было", "undo"),
        ("нет верни как было", "undo"),
        ("верни как было", "undo"),
    ]);
}

#[test]
fn a_complaint_said_before_undo_is_its_reason_and_not_a_step() {
    acts(&[
        ("ой не то не то верни как было", "undo"),
        ("опять ты не то включила верни как было", "undo"),
        ("опять ты не то включила", "next"),
    ]);
}

#[test]
fn a_word_right_after_an_artist_kind_word_is_a_name() {
    acts_in_steps(&[
        (
            "включи группу пауза а потом группу стоп",
            &["play", "queue_add"],
        ),
        ("включи группу кино", &["play"]),
    ]);
}

#[test]
fn a_play_after_then_following_a_play_is_queued() {
    acts_in_steps(&[
        ("включи кино а потом включи земфиру", &["play", "queue_add"]),
        ("включи кино потом поставь земфиру", &["play", "queue_add"]),
        ("включи кино и включи земфиру", &["play", "play"]),
        ("пауза а потом громче", &["pause", "volume_up"]),
    ]);
}

#[test]
fn a_kind_word_with_a_command_word_after_then_following_a_play_is_queued_as_the_name() {
    acts_in_steps(&[
        ("включи кино потом группу стоп", &["play", "queue_add"]),
        ("включи кино а потом группу пауза", &["play", "queue_add"]),
        ("включи кино а потом пауза", &["play", "pause"]),
        ("группу стоп", &["stop"]),
        ("пауза а потом группу стоп", &["pause", "stop"]),
    ]);
}
