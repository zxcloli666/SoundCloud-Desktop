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

fn picked(text: &str, bare: Bare) -> String {
    let steps = read(&CATALOG, text, bare);
    match steps.first().and_then(|step| step.decision.as_ref()) {
        Some(Decision::Act { pick }) => {
            format!("{} {}", pick.entity.kind.name(), pick.entity.label())
        }
        _ => steps[0].intent.name().to_string(),
    }
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

fn asked_about(read: &str) -> Option<&str> {
    let (_, name) = read.strip_suffix('?')?.split_once(' ')?;
    (!read.contains(" + ")).then_some(name)
}

fn first_left(catalog: &FixtureCatalog, text: &str) -> String {
    let steps = read(catalog, text, Bare::Certain);
    let told: Vec<String> = steps.iter().map(told).collect();
    assert_eq!(told, ["none"], "{text}");
    let first = steps[0].candidates.first();
    first.map(Entity::label).unwrap_or_default()
}

fn heard_either_way(cases: &[(&str, &str)]) {
    for (text, read) in cases {
        assert_eq!(heard(text, Bare::Popular), *read, "{text}");
        match asked_about(read) {
            Some(name) => assert_eq!(first_left(&CATALOG, text), name, "{text}"),
            None => assert_eq!(heard(text, Bare::Certain), *read, "{text}"),
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

const LITTLE_KNOWN: &str = "kind\tname\tartist\tpopularity\taliases
album\tСинева\tНикто\t500\t
album\tКлассный\tНикто\t400\t
playlist\tТише едешь\t\t7000\t
track\tТуман\tНикто\t300\t
artist\tДно\t\t200\t
";

#[test]
fn an_album_or_a_playlist_called_by_its_kind_plays_however_little_known() {
    let called = [
        ("альбом синева", "play Никто - Синева"),
        ("плейлист тише едешь", "play Тише едешь"),
        ("подборка тише едешь", "play Тише едешь"),
    ];
    let talk = [
        "синева",
        "тише едешь",
        "классный альбом",
        "синева альбом",
        "альбом синий",
        "трек туман",
        "группа дно",
    ];
    for bare in BOTH {
        for (text, read) in called {
            assert_eq!(heard_in(LITTLE_KNOWN, text, bare), read, "{text}");
        }
        for text in talk {
            assert_eq!(heard_in(LITTLE_KNOWN, text, bare), "none", "{text}");
        }
        assert_eq!(heard("плейлист тише едешь", bare), "play Тише едешь");
        assert_eq!(heard("тише едешь", bare), "none");
    }
}

const SAME_WORD: &str = "kind\tname\tartist\tpopularity\taliases
playlist\tChill Vibes\t\t900000\tчилл
track\tChill\tНикто\t800000\t
";

#[test]
fn a_name_said_exactly_goes_before_a_better_known_one_that_is_only_called_so() {
    heard_either_way(&[
        ("плейлист чилл поставь", "play Chill?"),
        ("поставь плейлист чилл", "play Chill?"),
        ("включи чилл", "play Chill?"),
        ("включи чил вайбс", "play Chill Vibes"),
    ]);
    for bare in BOTH {
        let asked_kind = heard_in(SAME_WORD, "плейлист чилл поставь", bare);
        assert_eq!(asked_kind, "play Chill Vibes");
        let any_kind = heard_in(SAME_WORD, "включи чилл", bare);
        assert_eq!(any_kind, "play Никто - Chill");
    }
}

#[test]
fn a_far_less_known_name_said_exactly_stays_behind_the_known_one() {
    heard_either_way(&[
        ("включи викенд", "play The Weeknd"),
        ("включи weekend", "play The Weeknd"),
        ("включи скриптонид", "play Скриптонит"),
        ("включи макс корш", "play Макс Корж"),
    ]);
}

#[test]
fn a_title_in_the_performance_of_an_artist_is_that_artists_title() {
    heard_either_way(&[
        (
            "включи притон в исполнении дорадуры",
            "play Дорадура - Притон",
        ),
        (
            "включи кукушку в исполнении гагариной",
            "play Полина Гагарина - Кукушка",
        ),
        (
            "включи сансару в исполнении бастарда",
            "play Бастард - Сансара",
        ),
        (
            "включи лесник в исполнении короля и шута",
            "play Король и Шут - Лесник",
        ),
    ]);
}

#[test]
fn a_name_introduced_as_a_name_is_found_without_the_introduction() {
    heard_either_way(&[
        ("поставь группу которая называется плей", "play Play"),
        ("включи группу которая называется кино", "play Кино"),
        (
            "включи песню под названием лесник",
            "play Король и Шут - Лесник",
        ),
        (
            "поставь альбом который называется группа крови",
            "play Кино - Группа крови",
        ),
        (
            "включи плейлист с названием дорога домой",
            "play Дорога домой",
        ),
        ("как называется эта песня", "now_playing"),
    ]);
}

#[test]
fn an_unknown_title_after_an_artist_of_three_words_falls_back_to_the_artist() {
    heard_either_way(&[
        (
            "включи короля и шута проклятый старый дом",
            "play Король и Шут",
        ),
        ("включи короля и шута дом", "play Король и Шут"),
        (
            "включи miyagi и эндшпиль самурай в огне",
            "play Miyagi & Эндшпиль",
        ),
        ("включи руки вверх чужие губы", "play Руки Вверх"),
        ("включи на ютубе тот ролик про скриптонита", "none"),
    ]);
}

#[test]
fn one_name_of_a_credit_next_to_other_words_is_not_the_artist() {
    heard_either_way(&[
        ("включи короля льва", "none"),
        ("включи короля льва проклятый старый дом", "none"),
        ("включи шута горохового", "none"),
        ("билли джоэла поставь", "none"),
        ("включи короля ричарда", "play Король Ричард"),
        ("включи короля", "play Король и Шут"),
    ]);
}

#[test]
fn a_kind_word_is_read_into_the_name_only_when_that_name_is_found_as_said() {
    heard_either_way(&[
        ("включи группу аукцион", "none"),
        ("включи группу пикник", "none"),
        ("включи группу крови", "play Кино - Группа крови?"),
        ("включи группу кровь", "play Кино - Группа крови?"),
        ("включи группу кино", "play Кино"),
    ]);
}

#[test]
fn a_chain_runs_without_a_later_step_that_names_nothing_found() {
    heard_either_way(&[
        (
            "включи кино потом абракадабру и сделай погромче",
            "play Кино + volume_up",
        ),
        (
            "включи притон только оригинал не трибьют",
            "play Скриптонит - Притон",
        ),
        ("сделай погромче и включи аукцион", "volume_up"),
        ("включи кино и сделай погромче", "play Кино + volume_up"),
    ]);
}

#[test]
fn nothing_runs_after_a_first_step_that_names_nothing_found() {
    heard_either_way(&[
        ("включи группу аукцион и сделай погромче", "none"),
        ("включи абракадабру и лайкни", "none"),
        ("включи абракадабру потом швабракадабру", "none"),
    ]);
}

#[test]
fn what_the_speaker_says_they_do_is_not_a_misheard_command() {
    heard_either_way(&[
        ("баста я больше в это не играю", "none"),
        ("я сейчас включу кино", "none"),
        ("кино я сейчас поставлю", "none"),
        ("я потом сам включу кино", "none"),
        ("земфиру играю", "none"),
        ("продолжу потом", "none"),
        ("вклчи кино", "play Кино"),
        ("запусьти кино", "play Кино"),
        ("паусу", "pause"),
    ]);
}

#[test]
fn a_phrase_without_a_verb_that_takes_back_a_part_of_itself_is_talk() {
    heard_either_way(&[
        ("звери а не люди", "none"),
        ("кино а не звери", "none"),
        ("скриптонит но не баста", "none"),
        ("ленинград это город а не группа", "none"),
        ("включи кино а не звери", "play Кино"),
        ("вруби басту а не стой лучше скриптонита", "play Скриптонит"),
        ("не кино а звери", "play Звери"),
        ("звери", "play Звери"),
    ]);
}

#[test]
fn a_version_of_a_title_is_the_title_by_the_artist_who_plays_that_version() {
    heard_either_way(&[
        (
            "включи караоке версию старбой",
            "play Weeknd Karaoke - Starboy",
        ),
        (
            "включи пиано версию бэд гай",
            "play Billie Eilish Piano - bad guy",
        ),
        (
            "поставь версию лесника от короля и шута",
            "play Король и Шут - Лесник",
        ),
    ]);
}

#[test]
fn of_two_names_to_ask_about_the_one_closer_to_what_was_said_goes_first() {
    heard_either_way(&[
        ("мотыльков вруби", "play Мотыльки?"),
        ("мотыльков вруби лоля", "play Мотыльки?"),
        (
            "включи караоке версию блайндинг лайтс",
            "play Weeknd Karaoke - Blinding Lights?",
        ),
        (
            "включи блайндинг лайтс караоке",
            "play Weeknd Karaoke - Blinding Lights?",
        ),
    ]);
}

#[test]
fn of_two_names_equally_close_the_better_known_one_still_goes_first() {
    heard_either_way(&[
        ("включи кукушку", "play Кино - Кукушка?"),
        ("включи хочу", "play Земфира - Хочу?"),
        ("включи группу крови", "play Кино - Группа крови?"),
        ("включи мотылька", "play Макс Корж - Мотылёк"),
    ]);
}

#[test]
fn a_command_word_after_a_kind_word_names_what_that_kind_has_under_it() {
    let named = [
        ("плейлист пауза", "playlist Пауза"),
        ("плейлист громче", "playlist Громче"),
        ("плейлист дальше", "playlist Дальше"),
        ("альбом дальше", "album Мот - Дальше"),
        ("группа пауза", "artist Пауза"),
        ("группа стоп", "artist Стоп"),
    ];
    let commands = [
        ("альбом громче", "volume_up"),
        ("группа громче", "volume_up"),
        ("плейлист тише", "volume_down"),
        ("альбом стоп", "stop"),
        ("трек дальше", "next"),
    ];
    for bare in BOTH {
        for (text, read) in named.iter().chain(&commands) {
            assert_eq!(picked(text, bare), *read, "{text}");
        }
    }
}

const KNOWN_BY_A_SHORT_NAME: &str = "kind\tname\tartist\tpopularity\taliases
artist\tThe Weeknd\t\t92000000\t
artist\tWeekend\t\t900000\t
";

#[test]
fn a_name_found_by_the_name_it_is_known_by_stays_first_when_asking() {
    let catalog = FixtureCatalog::from_tsv(KNOWN_BY_A_SHORT_NAME, true);
    for text in ["включи уикенд", "поставь зе уикенд", "включи уик энд"]
    {
        let asked = heard_in(KNOWN_BY_A_SHORT_NAME, text, Bare::Popular);
        assert_eq!(asked, "play The Weeknd?", "{text}");
        assert_eq!(first_left(&catalog, text), "The Weeknd", "{text}");
    }
}
