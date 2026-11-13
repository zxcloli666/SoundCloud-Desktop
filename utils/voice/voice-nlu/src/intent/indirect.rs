use super::ctx::{Ctx, Detected};
use crate::lexicon::{ASKS_TO_TALK, BEFORE_THIS, JUNK, PRE};
use crate::types::Intent;

const FILL: &[&str] = &[
    "слишком",
    "очень",
    "как",
    "чтото",
    "совсем",
    "уж",
    "ужасно",
    "вообще",
    "прям",
    "реально",
    "играет",
    "звучит",
    "немного",
    "то",
    "же",
    "ли",
    "это",
    "такой",
    "както",
    "что",
    "тут",
    "там",
    "в",
    "комнате",
    "здесь",
    "квартире",
    "машине",
];

const ASKED_OR_PLACED: &[&str] = &[
    "сделай",
    "поставь",
    "ставь",
    "включи",
    "давай",
    "верни",
    "сделать",
    "в",
    "во",
    "у",
];

const ENGLISH_FILL: &[&str] = &[
    "the", "this", "that", "it", "a", "song", "track", "music", "just", "really",
];
const THE_PLAYER: &[&str] = &["звук", "музыка", "громкость"];
const WHY: &[&str] = &["чего", "почему", "зачем", "какого"];
const WHY_REST: &[&str] = &[
    "хрена",
    "черта",
    "фига",
    "играет",
    "играешь",
    "орет",
    "орешь",
];
const NOT_NEEDED: &[&str] = &["надо", "нужно"];
const ANOTHER: &[&str] = &[
    "следующую",
    "следующий",
    "другую",
    "другой",
    "другое",
    "дальше",
    "давай",
];
const HEARD: &[&str] = &[
    "слышал",
    "слышала",
    "слышали",
    "слушал",
    "слушала",
    "слушали",
];
const TOO: &[&str] = &["слишком", "очень", "чересчур"];
const TOO_MUCH: &[&str] = &["слишком", "чересчур"];

pub(super) struct Rule {
    min: usize,
    needs: &'static [&'static [&'static str]],
    extra: &'static [&'static str],
    forbid: &'static [&'static str],
    intent: Intent,
}

impl Rule {
    pub(super) const fn len(mut self, min: usize) -> Rule {
        self.min = min;
        self
    }
}

pub(super) const fn rule(
    needs: &'static [&'static [&'static str]],
    extra: &'static [&'static str],
    forbid: &'static [&'static str],
    intent: Intent,
) -> Rule {
    Rule {
        min: 1,
        needs,
        extra,
        forbid,
        intent,
    }
}

pub(super) const THIS: &[&str] = &[
    "этот",
    "эта",
    "эту",
    "это",
    "трек",
    "песня",
    "песню",
    "ее",
    "его",
    "её",
];
const OTHER_ONE: &[&str] = &["другая", "другую", "другой", "другое", "будет", "играет"];
const PAST: &[&str] = &[
    "включила",
    "включил",
    "поставил",
    "поставила",
    "выбрала",
    "выбрал",
];

const RULES: &[Rule] = &[
    rule(
        &[&["не"], &["повторять", "повторяй"]],
        &[],
        &[],
        Intent::RepeatOff,
    ),
    rule(
        &[&["сделай", "поставь", "сделать"], &["громко"]],
        &[],
        &[],
        Intent::VolumeUp,
    ),
    rule(
        &[
            &["сделай", "поставь", "сделать"],
            &["тихо", "тихонько", "тихонечко", "потихоньку"],
        ],
        &[],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[&["не"], &["хочу", "нужно", "надо"], &["музыки", "музыку"]],
        &["больше"],
        &[],
        Intent::Stop,
    ),
    rule(
        &[&["достаточно"], &["музыки"]],
        &["на", "сегодня", "уже", "пока", "с", "меня"],
        &[],
        Intent::Stop,
    ),
    rule(
        &[
            &["предыдущая", "предыдущую", "прошлая", "прошлую"],
            &["была", "лучше"],
        ],
        &[],
        &[],
        Intent::Previous,
    ),
    rule(
        &[&["тихо", "тихая", "тихий", "тихонько"]],
        &["играет"],
        ASKED_OR_PLACED,
        Intent::VolumeUp,
    )
    .len(2),
    rule(
        &[
            &["слышно", "слышу", "слышать"],
            &["не", "плохо", "еле", "ничего", "слабо"],
        ],
        &["музыку", "ничего", "музыка"],
        &[],
        Intent::VolumeUp,
    ),
    rule(
        &[&["громко"]],
        &["играет"],
        ASKED_OR_PLACED,
        Intent::VolumeDown,
    )
    .len(2),
    rule(
        &[WHY, &["громко"]],
        WHY_REST,
        ASKED_OR_PLACED,
        Intent::VolumeDown,
    ),
    rule(
        &[WHY, &["тихо"]],
        WHY_REST,
        ASKED_OR_PLACED,
        Intent::VolumeUp,
    ),
    rule(
        &[
            &["уши"],
            &["болят", "вянут", "режет"],
            &["громкости", "громко", "звука", "музыки"],
        ],
        &["от", "этой", "этого", "уже"],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[JUNK, &["играет", "играешь"]],
        &["и", "опять", "какуюто"],
        &["что", "за"],
        Intent::Next,
    ),
    rule(&[TOO_MUCH, &["тихо"]], &[], &[], Intent::VolumeUp),
    rule(&[TOO_MUCH, &["громко"]], &[], &[], Intent::VolumeDown),
    rule(
        &[THE_PLAYER, TOO, &["громкий", "громкая", "громко"]],
        &[],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[THE_PLAYER, TOO, &["тихий", "тихая", "тихо"]],
        &[],
        &[],
        Intent::VolumeUp,
    ),
    rule(&[&["громковато"]], &[], ASKED_OR_PLACED, Intent::VolumeDown),
    rule(
        &[&[
            "оглушает",
            "оглушительно",
            "закладывает",
            "оглохнуть",
            "оглохну",
        ]],
        &["уши", "можно", "громко"],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[&["соседи"], &["стучат", "жалуются", "недовольны"]],
        &["на", "шум", "опять", "снова", "уже"],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[&["опять", "снова"], THIS],
        &[],
        &["хочу", "слушать"],
        Intent::Next,
    ),
    rule(
        &[HEARD, &["раз", "раза"]],
        &["1", "уже", "100", "10"],
        &[],
        Intent::Next,
    ),
    rule(&[HEARD, &["уже"], THIS], ANOTHER, &["не"], Intent::Next),
    rule(&[&["не"], NOT_NEEDED, THIS], ANOTHER, &[], Intent::Next),
    rule(
        &[&["фу"]],
        &["что", "это", "такое", "за"],
        &[],
        Intent::Next,
    ),
    rule(&[&["не"], &["мое", "моё"]], &[], &[], Intent::Next),
    rule(
        &[&["не"], &["хочу"], THIS],
        OTHER_ONE,
        &["слышать", "слушать"],
        Intent::Next,
    ),
    rule(&[&["не"], &["то"]], PAST, &[], Intent::Next),
    rule(&[&["не"], THIS], &[], &["нравится", "хочу"], Intent::Next),
    rule(
        &[
            &["другое", "другую", "другой"],
            &["чтонибудь", "давай", "можно", "песню"],
        ],
        &[],
        &[],
        Intent::Next,
    ),
    rule(
        &[
            &["поменяй", "смени", "замени", "сменить"],
            &["песню", "трек"],
        ],
        &[],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["слышать", "слушать"], &["не"], &["хочу"]],
        &["больше"],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["нравится"], &["не"], THIS],
        &["мне"],
        &["больше"],
        Intent::Next,
    ),
    rule(
        &[&["надоело", "надоела", "надоел"]],
        THIS,
        &[],
        Intent::Next,
    ),
    rule(
        &[&["разлюбил", "разлюбила", "разлюбить"]],
        THIS,
        &[],
        Intent::Unlike,
    ),
    rule(
        &[&["больше"], &["не"], &["нравится"]],
        THIS,
        &[],
        Intent::Unlike,
    ),
    rule(
        &[&["обожаю", "люблю"], THIS],
        &[],
        &["слушать", "я"],
        Intent::Like,
    ),
    rule(
        &[
            &["добавь"],
            &["в"],
            &["мои", "мою"],
            &["треки", "песни", "коллекцию"],
        ],
        &[],
        &[],
        Intent::Like,
    ),
    rule(
        &[
            &["сохрани"],
            &["отличный", "классный", "клевый", "супер", "хороший"],
        ],
        &["трек", "песня"],
        &[],
        Intent::Like,
    ),
    rule(
        &[&["верни", "вернуть"], &["трек", "песню", "ту", "эту"]],
        BEFORE_THIS,
        &[],
        Intent::Previous,
    ),
    rule(&[&["звук"], &["обратно"]], &[], &[], Intent::Unmute),
    rule(
        &[&["чей", "чья"], &["трек", "песня", "композиция", "мелодия"]],
        &[],
        &[],
        Intent::NowPlaying,
    ),
    rule(&[&["кто"], &["это"]], &["автор"], &[], Intent::NowPlaying),
    rule(&[&["кто"], &["автор"]], &[], &[], Intent::NowPlaying),
    rule(
        &[&["who", "whos"], &["this", "that"]],
        &["is", "singing", "artist"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[&["зовут"], &["исполнителя", "артиста", "певца", "певицу"]],
        &["как"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[&["напомни"], &["название"]],
        &["песни", "трека"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[&["звонят", "звонок", "звонит", "позвонили"]],
        &[
            "у",
            "меня",
            "мне",
            "тихо",
            "в",
            "дверь",
            "домофон",
            "телефон",
            "пауза",
            "паузу",
        ],
        &[],
        Intent::Pause,
    ),
    rule(
        &[&[
            "погоди",
            "подожди",
            "постой",
            "минутку",
            "секунду",
            "секундочку",
            "минуточку",
            "момент",
        ]],
        &["1", "одну", "сек"],
        &[],
        Intent::Pause,
    ),
    rule(&[&["тишина", "тишину"]], &[], &[], Intent::Pause),
    rule(
        &[&["ухожу", "спать"], &["выключи", "выключай", "выруби"]],
        &["пора", "я"],
        &[],
        Intent::Stop,
    ),
    rule(
        &[&["еще"], &["раз"]],
        &["давай", "эту", "песню", "этот", "трек", "ее", "его"],
        &[],
        Intent::SeekTo,
    ),
    rule(&[&["начала"], &["самого", "с"]], &[], &[], Intent::SeekTo),
    rule(
        &[&["чтонибудь"]],
        &["для", "настроения", "из", "старого", "нового", "фоном"],
        ASKS_TO_TALK,
        Intent::PlayWave,
    ),
    rule(
        &[
            &["чтонибудь"],
            &["фоном", "настроения", "старого", "нового"],
        ],
        &["поставь", "включи", "для", "из"],
        &[],
        Intent::PlayWave,
    ),
    rule(&[&["музыку"]], &[], &[], Intent::PlayWave),
];

pub fn detect(c: &Ctx) -> Option<Detected> {
    if c.len() > 8 {
        return None;
    }
    if c.w.iter().filter(|w| **w == "снова").count() >= 2 {
        return Some(Detected::new(Intent::RepeatOne, vec![]));
    }
    let rules = RULES.iter().chain(super::blunt::RULES);
    for r in rules.chain(super::english::RULES) {
        if c.len() < r.min {
            continue;
        }
        if r.forbid.iter().any(|f| c.w.contains(f)) {
            continue;
        }
        if !r
            .needs
            .iter()
            .all(|group| group.iter().any(|a| c.w.contains(a)))
        {
            continue;
        }
        let covered = c.w.iter().all(|w| {
            r.needs.iter().any(|g| g.contains(w))
                || r.extra.contains(w)
                || FILL.contains(w)
                || ENGLISH_FILL.contains(w)
                || PRE.contains(w)
        });
        if covered {
            let said = match r.intent {
                Intent::PlaySimilar => (0..c.len()).collect(),
                _ => vec![],
            };
            let d = Detected::new(r.intent, said);
            return Some(match r.intent {
                Intent::SeekTo => d.number(0),
                Intent::VolumeSet => d.number(100),
                _ => d,
            });
        }
    }
    None
}
