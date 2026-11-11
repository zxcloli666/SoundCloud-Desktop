use std::sync::LazyLock;

use voice_nlu::Names;
use voice_resolve::{Bare, Boosts, Decision, Entity, FixtureCatalog, Outcome, interpret};

const BOTH: [Bare; 2] = [Bare::Popular, Bare::Certain];
const VOICE: [&str; 3] = ["Loli", "Лоля", "롤리"];

static CATALOG: LazyLock<FixtureCatalog> =
    LazyLock::new(|| FixtureCatalog::from_tsv(include_str!("data/catalog.tsv"), true));

fn heard(text: &str, bare: Bare) -> String {
    let told: Vec<String> = read(&CATALOG, text, bare).iter().map(told).collect();
    told.join(" + ")
}

fn heard_in(rows: &str, text: &str, bare: Bare) -> String {
    let catalog = FixtureCatalog::from_tsv(rows, true);
    let told: Vec<String> = read(&catalog, text, bare).iter().map(told).collect();
    told.join(" + ")
}

fn handed(text: &str) -> Vec<String> {
    let steps = read(&CATALOG, text, Bare::Certain);
    let hits = steps.iter().flat_map(|step| &step.candidates);
    hits.map(Entity::label).collect()
}

fn read(catalog: &FixtureCatalog, text: &str, bare: Bare) -> Vec<Outcome> {
    interpret(text, catalog, &Boosts::none(), bare, &Names::new(&VOICE))
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

#[test]
fn something_like_this_wished_for_plays_similar_and_nothing_like_it_is_talk() {
    heard_either_way(&[
        ("хочется чего-нибудь похожего на это", "play_similar"),
        ("хочу чего-нибудь похожего", "play_similar"),
        ("поставь чего-нибудь подобного", "play_similar"),
        ("мне бы чего-нибудь похожего", "play_similar"),
        ("ничего похожего", "none"),
        ("нет ничего похожего на это", "none"),
    ]);
}

#[test]
fn a_kind_word_said_first_makes_the_kind_or_command_word_after_it_the_name() {
    heard_either_way(&[
        ("группу брат поставь", "play Брат"),
        ("группу альбом включи", "play Альбом"),
        ("альбом дальше включи", "play Мот - Дальше"),
        ("плейлист дальше включи", "play Дальше"),
        ("исполнителя трек запусти", "play Трек"),
        ("группу плей поставь", "play Play"),
    ]);
}

#[test]
fn a_kind_word_before_the_verb_with_no_name_after_it_still_starts_the_wave() {
    heard_either_way(&[
        ("песню включи", "play_wave"),
        ("альбом включи", "play_wave"),
        ("песню любую включи", "play_wave"),
        ("песню эту включи", "play_wave"),
        ("группу какую-нибудь включи", "play_wave"),
        ("альбом снова включи", "play_wave"),
        ("брат группу включи", "play_wave"),
        ("группу включи брат", "play_wave"),
        ("песню дальше включи", "next"),
        ("плейлист мой включи", "play_likes"),
    ]);
}

const KIND_NAMES: &str = "kind\tname\tartist\tpopularity\taliases
track\tПесня года\tНикто\t900000\t
playlist\tПлейлист дня\t\t700000\t
artist\tКрови\t\t300\t
";

#[test]
fn a_name_that_starts_with_a_kind_word_is_found_when_said_alone() {
    for text in ["группа крови", "кино группа крови"] {
        assert_eq!(heard(text, Bare::Popular), "play Кино - Группа крови?");
        assert_eq!(heard(text, Bare::Certain), "none", "{text}");
        assert_eq!(handed(text)[0], "Кино - Группа крови", "{text}");
    }
    let named = [
        ("песня года", "play Никто - Песня года"),
        ("плейлист дня", "play Плейлист дня"),
        ("группа крови", "none"),
    ];
    for (text, read) in named {
        assert_eq!(heard_in(KIND_NAMES, text, Bare::Popular), read, "{text}");
        assert_eq!(heard_in(KIND_NAMES, text, Bare::Certain), "none", "{text}");
    }
}
