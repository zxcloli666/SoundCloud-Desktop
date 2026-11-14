use voice_nlu::{Names, Parsed, parse};

fn read(text: &str) -> Vec<Parsed> {
    parse(text, &Names::new(&["Лоля"]))
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
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
fn junk_said_of_the_song_skips_it() {
    acts(&[
        ("хуйня а не песня давай другую", "next"),
        ("фигня а не песня", "next"),
        ("отстой а не музыка", "next"),
        ("ну и херня", "next"),
        ("выруби эту херню", "stop"),
    ]);
    stays_silent(&["хуйня", "что за херня"]);
}

#[test]
fn a_command_held_back_gives_way_to_the_one_said_after() {
    acts(&[
        ("стоп погоди играй", "resume"),
        ("стоп стой играй", "resume"),
        ("пауза погоди играй", "resume"),
        ("стоп подожди продолжай", "resume"),
        ("громче погоди тише", "volume_down"),
        ("играй погоди пауза", "pause"),
        ("пауза погоди минутку", "pause"),
    ]);
    assert_eq!(steps("потише подожди секунду"), ["volume_down", "pause"]);
}

#[test]
fn louder_with_a_family_member_sent_away_is_for_the_player() {
    acts(&[("громче мам не мешай", "volume_up")]);
    stays_silent(&["тише мам не мешай", "громче дедушка"]);
}

#[test]
fn slang_for_turning_the_knob_changes_the_volume() {
    acts(&[
        ("накрути звук", "volume_up"),
        ("скрути немного", "volume_down"),
        ("накрути на максимум", "volume_set"),
    ]);
}

#[test]
fn an_end_to_repeating_turns_the_repeat_off() {
    acts(&[
        ("перестань повторять песню", "repeat_off"),
        ("хватит повторять", "repeat_off"),
    ]);
}

#[test]
fn a_lone_halt_word_stops() {
    acts(&[
        ("стой", "stop"),
        ("стой стой стой", "stop"),
        ("ну стой", "stop"),
    ]);
    stays_silent(&["стой тут", "стой там", "стой здесь"]);
}

#[test]
fn likes_that_are_refused_are_not_played() {
    stays_silent(&["только не мои лайки"]);
    acts(&[("мои лайки", "play_likes")]);
}

#[test]
fn a_story_about_something_left_on_pause_is_not_pause() {
    stays_silent(&["на паузе стоял фильм пока я готовил"]);
    acts(&[("поставь на паузе", "pause")]);
}

#[test]
fn the_volume_of_a_phone_is_not_the_volume_of_the_player() {
    stays_silent(&["громкость звонка на телефоне поставь на максимум"]);
    acts(&[
        ("громкость на максимум", "volume_set"),
        ("поставь громкость на 50", "volume_set"),
    ]);
}

#[test]
fn going_on_with_something_else_is_not_resume() {
    stays_silent(&["пауза пять минут и продолжим урок", "продолжим урок"]);
    acts(&[("продолжим", "resume"), ("давай продолжим", "resume")]);
}

#[test]
fn this_one_turned_down_is_skipped() {
    acts(&[
        ("эту не надо следующую", "next"),
        ("эту уже слышала дальше", "next"),
    ]);
}

#[test]
fn someone_called_over_after_a_command_leaves_the_command() {
    acts(&[
        ("громче игорь иди сюда", "volume_up"),
        ("пауза иди сюда", "pause"),
    ]);
}

#[test]
fn a_ring_at_the_door_said_after_pause_leaves_the_pause() {
    acts(&[
        ("пауза звонят в дверь", "pause"),
        ("звонят в дверь", "pause"),
        ("пауза телефон звонит", "pause"),
    ]);
}

#[test]
fn neighbours_who_complain_of_the_noise_turn_it_down() {
    acts(&[("соседи жалуются на шум", "volume_down")]);
}

#[test]
fn a_name_said_to_come_behind_another_is_queued() {
    let text = "включи ленинград а за ним сплин";
    assert_eq!(steps(text), ["play", "queue_add"]);
    assert_eq!(read(text)[1].queries[0].text, "сплин");
}

#[test]
fn a_wish_said_after_a_name_stays_beside_it() {
    let kept = |text: &str| read(text)[0].queries.iter().any(|q| q.kept_fillers);
    assert!(kept("земфира хочу"));
    assert!(kept("мот хочу"));
    assert!(!kept("хочу земфиру"));
    assert!(!kept("земфиру хочу"));
    assert!(!kept("хочу мота"));
}
