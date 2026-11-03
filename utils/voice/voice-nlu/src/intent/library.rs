use super::ctx::{Ctx, Detected};
use crate::lexicon::*;
use crate::types::Intent;

const ADD_WORDS: &[&str] = &[
    "добавь", "добавить", "кинь", "закинь", "добавляй", "add", "put", "поставь", "запиши",
    "вставь", "queue",
];
const QUEUE_PREPS: &[&str] = &["в", "во", "to", "the", "on", "into", "at"];

pub fn undo(c: &Ctx) -> Option<Detected> {
    if c.len() > 5 {
        return None;
    }
    let by_word = c.has(UNDO_WORDS);
    let by_phrase = (c.has(&["верни"]) && c.has(&["как"]) && c.has(&["было"]))
        || (c.has(&["не"]) && c.has(&["то"]) && c.len() <= 3);
    let used: Vec<usize> = (0..c.len())
        .filter(|&i| UNDO_WORDS.contains(&c.w[i]) || matches!(c.w[i], "верни" | "как" | "было" | "не" | "то" | "действия" | "действие" | "последнее" | "последние"))
        .collect();
    if (by_word || by_phrase) && c.stray(&used) == 0 {
        return Some(Detected::new(Intent::Undo, vec![]));
    }
    None
}

const HELP_SET: &[&str] = &[
    "что", "чего", "ты", "умеешь", "умеете", "можешь", "делать", "какие", "у", "тебя", "есть",
    "команды", "как", "тобой", "пользоваться", "помощь", "помоги", "помогите", "справка", "help",
    "возможности", "what", "can", "you", "do", "мне", "пользоваться", "тобой",
];

pub fn help(c: &Ctx) -> Option<Detected> {
    if c.len() > 6 || !c.w.iter().all(|w| HELP_SET.contains(w) || PRE.contains(w) || GENERIC.contains(w)) {
        return None;
    }
    let ability = c.has(&["умеешь", "умеете", "можешь", "can"]) && c.has(&["что", "чего", "what"]);
    let how = c.has(&["как"]) && c.has_stem(&["пользов"]);
    let commands = c.has(&["команды", "возможности"]);
    let direct = c.has(&["помощь", "помоги", "помогите", "справка", "help"]);
    if ability || how || direct || commands {
        return Some(Detected::new(Intent::Help, vec![]));
    }
    None
}

pub fn queue(c: &Ctx) -> Option<Detected> {
    if let Some(q) = c.pos_stem(&["очеред", "queue"]) {
        let mut used = vec![q];
        for i in 0..q {
            if QUEUE_PREPS.contains(&c.w[i]) || ADD_WORDS.contains(&c.w[i]) || PLAY_STRONG.contains(&c.w[i]) {
                used.push(i);
            }
        }
        for i in q + 1..c.len() {
            if QUEUE_PREPS.contains(&c.w[i]) && i == q + 1 {
                used.push(i);
            }
        }
        for i in 0..c.len() {
            if ADD_WORDS.contains(&c.w[i]) || c.w[i] == "to" || c.w[i] == "the" {
                if !used.contains(&i) {
                    used.push(i);
                }
            }
        }
        return Some(Detected::new(Intent::QueueAdd, used));
    }
    let after = c.pos(&["после"]);
    if let Some(a) = after {
        let obj = c.at(a + 1);
        if matches!(obj, "этого" | "этой" | "нее" | "неё" | "текущей" | "этой") {
            let mut used = vec![a, a + 1];
            used.extend(c.all(PLAY_STRONG));
            return Some(Detected::new(Intent::QueueAdd, used));
        }
    }
    if c.has(QUEUE_AFTER) && c.has(PLAY_STRONG) && c.len() > 2 {
        let mut used = c.all(QUEUE_AFTER);
        used.extend(c.all(PLAY_STRONG));
        return Some(Detected::new(Intent::QueueAdd, used));
    }
    None
}

pub fn like(c: &Ctx) -> Option<Detected> {
    if c.len() > 6 {
        return None;
    }
    let unlike_word = c.has(UNLIKE_WORDS) || c.has_stem(&["разлайк", "дизлайк"]);
    let like_word = c.has(LIKE_WORDS)
        || c.w.iter().any(|w| w.starts_with("лайк") && !matches!(*w, "лайки" | "лайков"));
    let enjoys = c.has(&["нравится"]) && {
        let used = c.all(&["нравится"]);
        c.stray(&used) == 0 || c.w.iter().all(|w| LIKE_OBJECT.contains(w) || PRE.contains(w) || GENERIC.contains(w))
    };
    let used: Vec<usize> = (0..c.len())
        .filter(|&i| {
            let w = c.w[i];
            w.starts_with("лайк") || w.starts_with("избран") || w.starts_with("любим") || w == "из" || w == "нравится" || LIKE_WORDS.contains(&w) || UNLIKE_WORDS.contains(&w) || REMOVE_WORDS.contains(&w) || matches!(w, "добавь" | "добавить" | "сохрани" | "save")
        })
        .collect();
    let lone = c.stray(&used) == 0;
    if !lone {
        return None;
    }
    if unlike_word {
        return Some(Detected::new(Intent::Unlike, vec![]));
    }
    if like_word && c.has(REMOVE_WORDS) {
        return Some(Detected::new(Intent::Unlike, vec![]));
    }
    if enjoys && c.has(&["не"]) {
        return Some(Detected::new(Intent::Unlike, vec![]));
    }
    if (c.has(&["из"]) && c.has_stem(&["избранн", "любим"]) && c.has(REMOVE_WORDS))
        || (c.has(REMOVE_WORDS) && c.has(&["из"]) && c.has_stem(&["избран", "лайк"]))
    {
        return Some(Detected::new(Intent::Unlike, vec![]));
    }
    if like_word && !c.has(MINE) {
        return Some(Detected::new(Intent::Like, vec![]));
    }
    if enjoys {
        return Some(Detected::new(Intent::Like, vec![]));
    }
    if c.has_stem(&["избранн"]) && c.has(&["добавь", "добавить", "в", "save", "сохрани"]) && c.has(&["в"]) {
        return Some(Detected::new(Intent::Like, vec![]));
    }
    None
}

pub fn shuffle(c: &Ctx) -> Option<Detected> {
    if c.len() > 7 {
        return None;
    }
    let word = c.has(SHUFFLE_WORDS) || c.has_stem(&["перемеш", "перемиш", "шафл"]);
    let ordered = c.has(&["порядку"]) && c.has(&["по"]);
    let random_order = c.has(&["случайном"]) && c.has(&["порядке"]);
    if !word && !ordered && !random_order {
        return None;
    }
    let off = c.has(NEGATE) || c.has(&["off"]) || ordered;
    let on = c.has(&["on"]);
    if off && !on {
        return Some(Detected::new(Intent::ShuffleOff, vec![]));
    }
    Some(Detected::new(Intent::ShuffleOn, vec![]))
}

pub fn repeat(c: &Ctx) -> Option<Detected> {
    if c.len() > 7 {
        return None;
    }
    let word = c.has(REPEAT_WORDS) || c.has_stem(&["повтор", "повтар", "зацикл"]);
    if !word {
        return None;
    }
    let mut off = c.has(&["не", "без", "off"]) || (c.has(&["stop"]) && c.has(&["repeat"]));
    off |= c.has(&["выключи", "отключи", "хватит", "прекрати", "убери", "выключить", "отключить"]);
    if off {
        return Some(Detected::new(Intent::RepeatOff, vec![]));
    }
    let all = c.has(REPEAT_ALL) || c.has_stem(&["плейлист", "очеред", "альбом"]);
    if all && !c.has(&["1", "one", "трек", "песню", "эту", "этот"]) {
        return Some(Detected::new(Intent::RepeatAll, vec![]));
    }
    Some(Detected::new(Intent::RepeatOne, vec![]))
}

const NOW_SET: &[&str] = &[
    "что", "чё", "кто", "what", "whats", "who", "whos", "это", "за", "какая", "какой", "играет",
    "playing", "звучит", "как", "называется", "название", "поет", "исполняет", "исполнитель",
    "артист", "группа", "певец", "singer", "sings", "singing", "this", "is", "song", "track",
    "called", "right", "now", "сейчас", "эта", "этот", "песня", "трек", "музыка", "композиция",
];

pub fn now_playing(c: &Ctx) -> Option<Detected> {
    if c.len() > 8 {
        return None;
    }
    if !c.w.iter().all(|w| NOW_SET.contains(w) || PRE.contains(w) || GENERIC.contains(w) || KIND_ARTIST.contains(w)) {
        return None;
    }
    let what = c.has(&["что", "what", "whats", "кто", "who", "whos", "какая", "какой"]);
    let playing = c.has(PLAYING_WORDS);
    let song_q = c.has(&["за"]) && c.has_stem(&["песн", "трек", "музык", "композиц", "исполн", "артист", "групп", "певец"]);
    let english = c.has(&["song", "track"]) && c.has(&["this", "is", "playing", "called"]) && what;
    let named = c.has(&["как"]) && c.has_stem(&["называ"]);
    let who = c.has(&["кто", "who", "whos"]) && c.has(WHO_WORDS);
    let title = c.has_stem(&["название"]);
    if (what && playing) || song_q || english || named || who || title {
        return Some(Detected::new(Intent::NowPlaying, vec![]));
    }
    None
}
