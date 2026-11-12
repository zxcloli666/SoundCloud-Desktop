use std::collections::HashSet;
use std::sync::OnceLock;

mod content;
mod ear;
mod filler;
mod guard;
mod kinds;
mod library;
mod names;
mod noise;
mod play;
mod regional;
mod seek;
mod talk;
mod transport;
mod volume;

pub use content::*;
pub use ear::*;
pub use filler::*;
pub use guard::*;
pub use kinds::*;
pub use library::*;
pub use names::*;
pub use noise::*;
pub use play::*;
pub use regional::*;
pub use seek::*;
pub use talk::*;
pub use transport::*;
pub use volume::*;

pub const ALL_LISTS: &[&[&str]] = &[
    FILLERS,
    AMBIGUOUS,
    PLAY_STRONG,
    PLAY_WEAK,
    PRE,
    KIND_TRACK,
    KIND_TRACK_PLURAL,
    KIND_ALBUM,
    KIND_PLAYLIST,
    KIND_ARTIST,
    WAVE,
    WAVE_NEEDS_VERB,
    LIKES,
    LIKES_PLURAL,
    MINE,
    SIMILAR,
    UP_WORDS,
    DOWN_WORDS,
    VOL_NOUNS,
    ON_VERBS,
    OFF_VERBS,
    MUTE_WORDS,
    HALF,
    MAX_WORDS,
    MIN_WORDS,
    FORWARD,
    BACKWARD,
    SEEK_VERBS,
    JUMP_VERBS,
    SKIP_VERBS,
    SEC_UNITS,
    MIN_UNITS,
    HALF_MINUTE,
    ONE_AND_HALF,
    RESTART,
    UNDO_WORDS,
    HELP_WORDS,
    QUEUE_WORDS,
    LIKE_WORDS,
    UNLIKE_WORDS,
    SHUFFLE_WORDS,
    REPEAT_WORDS,
    NEXT_WEAK,
    PREV_WEAK,
    PAUSE_WORDS,
    STOP_WORDS,
    RESUME_WORDS,
    PLAYING_WORDS,
    GENERIC,
    DENY,
    WHO_WORDS,
    ADD_WORDS,
    REMOVE_WORDS,
];

pub const EXTRA_KNOWN: &[&str] = &[
    "следующий",
    "следующая",
    "следующую",
    "следующее",
    "следующие",
    "предыдущий",
    "предыдущая",
    "предыдущую",
    "предыдущее",
    "остановка",
    "остановку",
    "остановки",
    "класс",
    "классно",
    "хорошо",
    "здорово",
    "ссылка",
    "сейчас",
    "сначала",
    "нибудь",
    "чтонибудь",
    "что",
    "как",
    "для",
    "про",
    "тихо",
    "громко",
    "песни",
    "кино",
    "андеграунд",
    "все",
    "нет",
    "называется",
    "нравится",
    "следующим",
    "следующей",
];

fn set() -> &'static HashSet<&'static str> {
    static SET: OnceLock<HashSet<&'static str>> = OnceLock::new();
    SET.get_or_init(|| known_words().collect())
}

pub fn known_words() -> impl Iterator<Item = &'static str> {
    let listed = ALL_LISTS.iter().flat_map(|list| list.iter().copied());
    let slang = SLANG.iter().flat_map(|(from, to)| [*from, *to]);
    listed.chain(EXTRA_KNOWN.iter().copied()).chain(slang)
}

pub fn is_known(w: &str) -> bool {
    set().contains(w)
}

pub fn has(list: &[&str], w: &str) -> bool {
    list.contains(&w)
}

pub fn stem(list: &[&str], w: &str) -> bool {
    list.iter().any(|s| w.starts_with(s))
}

pub fn slang(w: &str) -> Option<&'static str> {
    SLANG.iter().find(|(k, _)| *k == w).map(|(_, v)| *v)
}

pub fn swear(w: &str) -> Option<String> {
    if let Some((_, plain)) = SWEARS.iter().find(|(k, _)| *k == w) {
        return Some(plain.to_string());
    }
    let (stem, plain) = SWEAR_STEMS.iter().find(|(stem, _)| w.starts_with(stem))?;
    Some(if plain.is_empty() {
        String::new()
    } else {
        format!("{plain}{}", &w[stem.len()..])
    })
}

pub const FUZZY_TARGETS: &[&str] = &[
    "включи",
    "выключи",
    "поставь",
    "запусти",
    "играй",
    "пауза",
    "паузу",
    "останови",
    "продолжи",
    "следующий",
    "предыдущий",
    "громче",
    "тише",
    "потише",
    "погромче",
    "перемотай",
    "повтори",
    "повторить",
    "перемешай",
    "громкость",
    "лайк",
    "лайки",
    "очередь",
    "звук",
    "вперед",
    "назад",
    "секунд",
    "минуту",
    "играет",
    "сейчас",
    "любимое",
    "волну",
    "рекомендации",
    "дальше",
    "сначала",
    "отмена",
    "отмени",
    "прошлый",
    "пропусти",
    "трек",
    "песню",
    "альбом",
    "плейлист",
];

pub const SLURRED_TARGETS: &[&str] = &[
    "команды",
    "следующим",
    "следующую",
    "следующая",
    "предыдущую",
    "предыдущая",
    "остановись",
    "остановить",
    "отключи",
    "продолжай",
    "продолжить",
    "добавь",
    "убавь",
    "прибавь",
    "сделай",
    "волна",
    "волны",
    "повтор",
    "музыку",
    "репит",
];
