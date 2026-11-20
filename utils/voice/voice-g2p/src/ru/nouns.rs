use super::numbers::Gender;

const STEMS: &[(&str, Gender)] = &[
    ("трек", Gender::M),
    ("песн", Gender::F),
    ("песен", Gender::F),
    ("секунд", Gender::F),
    ("минут", Gender::F),
    ("час", Gender::M),
    ("день", Gender::M),
    ("дн", Gender::M),
    ("недел", Gender::F),
    ("месяц", Gender::M),
    ("год", Gender::M),
    ("лет", Gender::N),
    ("альбом", Gender::M),
    ("плейлист", Gender::M),
    ("исполнител", Gender::M),
    ("артист", Gender::M),
    ("процент", Gender::M),
    ("градус", Gender::M),
    ("раз", Gender::M),
    ("штук", Gender::F),
    ("лайк", Gender::M),
    ("подписчик", Gender::M),
    ("подписк", Gender::F),
    ("слов", Gender::N),
    ("мест", Gender::N),
    ("сообщени", Gender::N),
    ("уведомлени", Gender::N),
    ("пункт", Gender::M),
    ("километр", Gender::M),
    ("метр", Gender::M),
    ("сантиметр", Gender::M),
    ("миллиметр", Gender::M),
    ("килограмм", Gender::M),
    ("грамм", Gender::M),
    ("литр", Gender::M),
    ("рубл", Gender::M),
    ("копейк", Gender::F),
    ("доллар", Gender::M),
    ("шаг", Gender::M),
    ("раунд", Gender::M),
    ("круг", Gender::M),
    ("очк", Gender::N),
    ("балл", Gender::M),
    ("мину", Gender::F),
    ("страниц", Gender::F),
    ("глав", Gender::F),
    ("часть", Gender::F),
    ("част", Gender::F),
    ("серия", Gender::F),
    ("сери", Gender::F),
    ("эпизод", Gender::M),
    ("сезон", Gender::M),
    ("видео", Gender::N),
    ("клип", Gender::M),
    ("сингл", Gender::M),
    ("жанр", Gender::M),
    ("станци", Gender::F),
    ("волн", Gender::F),
    ("уровн", Gender::M),
    ("делени", Gender::N),
    ("человек", Gender::M),
    ("люд", Gender::P),
    ("друз", Gender::P),
    ("друг", Gender::M),
    ("девушк", Gender::F),
    ("квартир", Gender::F),
    ("этаж", Gender::M),
    ("дом", Gender::M),
    ("комнат", Gender::F),
    ("колонк", Gender::F),
    ("устройств", Gender::N),
    ("колон", Gender::F),
    ("сек", Gender::F),
    ("мин", Gender::F),
    ("пар", Gender::F),
    ("тысяч", Gender::F),
    ("миллион", Gender::M),
    ("миллиард", Gender::M),
];

pub fn gender_of(word: &str) -> Option<Gender> {
    let mut best: Option<(usize, Gender)> = None;
    for (stem, gender) in STEMS {
        if let Some(rest) = word.strip_prefix(stem) {
            if rest.chars().count() <= 3 && best.is_none_or(|(len, _)| stem.len() > len) {
                best = Some((stem.len(), *gender));
            }
        }
    }
    best.map(|(_, g)| g)
}

pub fn guess_gender(word: &str) -> Gender {
    if let Some(g) = gender_of(word) {
        return g;
    }
    let last = word.chars().last().unwrap_or('м');
    match last {
        'а' | 'я' => Gender::F,
        'о' | 'е' => Gender::N,
        'ы' | 'и' => Gender::P,
        _ => Gender::M,
    }
}

pub struct Unit {
    pub names: &'static [&'static str],
    pub one: &'static str,
    pub few: &'static str,
    pub many: &'static str,
    pub gender: Gender,
}

pub const UNITS: &[Unit] = &[
    Unit { names: &["%", "процент", "проц"], one: "проц+ент", few: "проц+ента", many: "проц+ентов", gender: Gender::M },
    Unit { names: &["°", "°c", "°с", "градус"], one: "гр+адус", few: "гр+адуса", many: "гр+адусов", gender: Gender::M },
    Unit { names: &["км"], one: "километр", few: "километра", many: "километров", gender: Gender::M },
    Unit { names: &["м", "метр"], one: "м+етр", few: "м+етра", many: "м+етров", gender: Gender::M },
    Unit { names: &["см"], one: "сантим+етр", few: "сантим+етра", many: "сантим+етров", gender: Gender::M },
    Unit { names: &["мм"], one: "миллим+етр", few: "миллим+етра", many: "миллим+етров", gender: Gender::M },
    Unit { names: &["кг"], one: "килогр+амм", few: "килогр+амма", many: "килогр+аммов", gender: Gender::M },
    Unit { names: &["г", "гр"], one: "гр+амм", few: "гр+амма", many: "гр+аммов", gender: Gender::M },
    Unit { names: &["л"], one: "л+итр", few: "л+итра", many: "л+итров", gender: Gender::M },
    Unit { names: &["мин"], one: "мин+ута", few: "мин+уты", many: "мин+ут", gender: Gender::F },
    Unit { names: &["сек", "с"], one: "сек+унда", few: "сек+унды", many: "сек+унд", gender: Gender::F },
    Unit { names: &["ч"], one: "час", few: "час+а", many: "час+ов", gender: Gender::M },
    Unit { names: &["гц"], one: "герц", few: "г+ерца", many: "г+ерц", gender: Gender::M },
    Unit { names: &["кгц"], one: "килог+ерц", few: "килог+ерца", many: "килог+ерц", gender: Gender::M },
    Unit { names: &["дб"], one: "децибел", few: "децибел+а", many: "децибел+ов", gender: Gender::M },
    Unit { names: &["₽", "руб", "р"], one: "рубл+ь", few: "рубл+я", many: "рубл+ей", gender: Gender::M },
    Unit { names: &["$"], one: "д+оллар", few: "д+оллара", many: "д+олларов", gender: Gender::M },
    Unit { names: &["€"], one: "+евро", few: "+евро", many: "+евро", gender: Gender::M },
    Unit { names: &["bpm"], one: "уд+ар в мин+уту", few: "уд+ара в мин+уту", many: "уд+аров в мин+уту", gender: Gender::M },
    Unit { names: &["мб"], one: "мегабайт", few: "мегабайта", many: "мегабайт", gender: Gender::M },
    Unit { names: &["гб"], one: "гигабайт", few: "гигабайта", many: "гигабайт", gender: Gender::M },
    Unit { names: &["кб"], one: "килобайт", few: "килобайта", many: "килобайт", gender: Gender::M },
];

pub fn unit(name: &str) -> Option<&'static Unit> {
    UNITS.iter().find(|u| u.names.contains(&name))
}

pub const MONTHS_GEN: [&str; 12] = [
    "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября",
    "октября", "ноября", "декабря",
];

pub fn is_year_noun(word: &str) -> Option<usize> {
    match word {
        "год" | "г" | "г." => Some(0),
        "года" => Some(1),
        "году" => Some(2),
        "годом" => Some(4),
        _ => None,
    }
}
