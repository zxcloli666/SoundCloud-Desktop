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
    ] {
        assert_eq!(words(kept), kept, "{kept}");
    }
    assert!(names("включи дабро").contains(&"дабро".to_string()));
    assert!(names("включи том йорк").contains(&"том йорк".to_string()));
    assert_eq!(steps("мы всю дорогу слушали валеру"), ["none"]);
}
