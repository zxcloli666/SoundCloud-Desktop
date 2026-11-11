use std::sync::LazyLock;

use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Decision, FixtureCatalog, Outcome, interpret};

const BOTH: [Bare; 2] = [Bare::Popular, Bare::Certain];
const VOICE: [&str; 3] = ["Loli", "Лоля", "롤리"];

static CATALOG: LazyLock<FixtureCatalog> =
    LazyLock::new(|| FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), true));

fn heard(text: &str, bare: Bare) -> String {
    let steps = interpret(text, &*CATALOG, &Boosts::none(), bare, &Names::new(&VOICE));
    let told: Vec<String> = steps.iter().map(told).collect();
    told.join(" + ")
}

fn told(outcome: &Outcome) -> String {
    let hit = match &outcome.decision {
        None | Some(Decision::NotFound) => String::new(),
        Some(Decision::Act { pick }) => format!(" {}", pick.entity.label()),
        Some(Decision::Ask { first, .. }) => format!(" {}?", first.entity.label()),
    };
    format!("{}{hit}", outcome.intent.name())
}

fn heard_either_way(cases: &[(&str, &str)]) {
    for bare in BOTH {
        for (text, read) in cases {
            assert_eq!(heard(text, bare), *read, "{text}");
        }
    }
}

#[test]
fn the_assistant_called_after_a_command_that_ends_with_its_verb_is_not_looked_up() {
    heard_either_way(&[
        ("бибера включи лоля", "play Justin Bieber"),
        ("коржа поставь лоля", "play Макс Корж"),
        ("группу кино запусти, лоля", "play Кино"),
        ("а земфиру мне поставь лоля", "play Земфира"),
        ("включи лоля", "none"),
        ("бибера включи лолю", "none"),
    ]);
}

#[test]
fn a_word_for_haste_next_to_the_verb_is_not_looked_up() {
    heard_either_way(&[
        (
            "включи быстренько мокрые кроссовки",
            "play Тима Белорусских - Мокрые кроссы",
        ),
        ("поставь быстренько некст левел", "play Next Level"),
        ("вруби поскорее кино", "play Кино"),
        ("запусти срочно басту сансару", "play Баста - Сансара"),
        ("поставь по-быстрому земфиру", "play Земфира"),
    ]);
}

#[test]
fn a_short_name_people_call_an_artist_by_finds_the_artist() {
    heard_either_way(&[
        ("включи скрипа", "play Скриптонит"),
        ("вруби нау", "play Наутилус Помпилиус"),
        ("горшка нам поставь", "play Король и Шут"),
        ("включи ка арбенину", "play Ночные Снайперы"),
        ("запусти ариану", "play Ariana Grande"),
        ("включи скрипа цепи", "play Скриптонит - Цепи"),
        ("включи риану", "play Rihanna"),
        ("включи донт старт нау", "play Dua Lipa - Don't Start Now"),
    ]);
}
