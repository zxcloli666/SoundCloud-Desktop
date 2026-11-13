use voice_nlu::{Kind, Names};
use voice_resolve::Phrase;

fn read(text: &str, names: &[&str]) -> Phrase {
    Phrase::read(text, &Names::new(names))
}

#[test]
fn a_phrase_tells_its_lookups_without_a_catalog() {
    let lookups = read("включи скриптонита", &[]).lookups();
    assert!(!lookups.is_empty());
    for lookup in &lookups {
        assert_eq!(lookup.kinds, Kind::ALL);
        assert!(!lookup.variants.is_empty());
    }
    let texts = |at: usize| lookups[at].variants.iter().map(|v| v.text.clone());
    assert!(texts(0).any(|text| text.contains("скриптонит")));
    let again = read("включи скриптонита", &[]).lookups();
    assert_eq!(lookups, again);
}

#[test]
fn a_phrase_that_needs_no_catalog_has_no_lookups() {
    for text in ["пауза", "громкость 50", "привет, лоля", "что умеешь"]
    {
        assert!(read(text, &["Лоля"]).lookups().is_empty(), "{text}");
    }
}

#[test]
fn a_name_that_may_be_part_of_a_name_is_looked_up_both_ways() {
    let with = read("michael jackson", &["Michael"]).lookups();
    let without = read("michael jackson", &[]).lookups();
    assert!(with.len() > without.len());
    for lookup in &without {
        assert!(with.contains(lookup));
    }
}

#[test]
fn only_a_phrase_with_a_verb_commands() {
    assert!(read("включи скриптонита", &[]).commands());
    assert!(read("пауза", &[]).commands());
    assert!(read("поставь на паузу и включи цепи", &[]).commands());
    assert!(!read("привет, как дела?", &[]).commands());
    assert!(!read("ало, ты тут?", &[]).commands());
    assert!(!read("скриптонит", &[]).commands());
}

#[test]
fn a_curated_name_of_the_whole_phrase_is_asked_first() {
    let known = [
        ("включи тейлор свифт", "Taylor Swift"),
        ("включи уикенд", "The Weeknd"),
    ];
    for (said, name) in known {
        let lookups = read(said, &[]).lookups();
        assert_eq!(lookups[0].variants[0].text, name, "{said}");
    }
}

#[test]
fn a_curated_artist_said_by_its_own_name_is_asked_first_as_an_artist() {
    let known = [
        ("включи руки вверх", "Руки Вверх"),
        ("включи машина времени", "Машина Времени"),
        ("включи филипп киркоров", "Филипп Киркоров"),
    ];
    for (said, name) in known {
        let lookups = read(said, &[]).lookups();
        let first = &lookups[0].variants[0];
        assert_eq!(first.text, name, "{said}");
        assert_eq!(first.alias_kind, Some(Kind::Artist), "{said}");
    }
}

#[test]
fn a_curated_name_the_cleanup_cuts_is_asked_first_as_it_was_said() {
    let cut = [
        ("включи дюран дюран", "Duran Duran"),
        ("включи джой дивижн", "Joy Division"),
        ("включи бони эм", "Boney M."),
        ("включи дэвида гетту", "David Guetta"),
        ("включи эй си ди си", "AC/DC"),
        ("поставь а-ха", "a-ha"),
        ("поставь а ха", "a-ha"),
    ];
    for (said, name) in cut {
        let lookups = read(said, &[]).lookups();
        let first = &lookups[0].variants[0];
        assert_eq!(first.text, name, "{said}");
        assert_eq!(first.alias_kind, Some(Kind::Artist), "{said}");
    }
}

#[test]
fn a_curated_name_cut_in_one_step_is_not_asked_in_another() {
    let lookups = read("включи дюран дюран а потом включи скриптонита", &[]).lookups();
    assert_eq!(lookups.len(), 2);
    assert_eq!(lookups[0].variants[0].text, "Duran Duran");
    let later = lookups[1].variants.iter().map(|v| v.text.as_str());
    assert!(later.into_iter().all(|text| text != "Duran Duran"));
}

#[test]
fn a_cut_word_next_to_a_name_does_not_make_another_curated_name() {
    let near = [
        ("включи эминема ой нет не эминема а рианну", "Ariana Grande"),
        (
            "включи сансару басты а потом лесника короля и шута",
            "Баста",
        ),
    ];
    for (said, name) in near {
        let lookups = read(said, &[]).lookups();
        let asked = lookups.iter().flat_map(|lookup| &lookup.variants);
        let whole: Vec<&str> = asked
            .filter(|v| v.alias_kind.is_some() && v.title.is_none() && !v.fallback)
            .map(|v| v.text.as_str())
            .collect();
        assert!(!whole.contains(&name), "{said}: {whole:?}");
    }
}

fn heard(said: &str) -> Vec<String> {
    let lookups = read(said, &[]).lookups();
    let asked = lookups[0].variants.iter();
    let own = asked.filter(|v| v.alias_kind.is_none() && !v.fallback);
    own.map(|v| v.text.clone()).collect()
}

fn kept(said: &str) -> Vec<String> {
    let lookups = read(said, &[]).lookups();
    let asked = lookups[0].variants.iter();
    let kept = asked.filter(|v| v.kept_fillers);
    kept.map(|v| v.text.clone()).collect()
}

#[test]
fn a_name_the_cleanup_cuts_is_asked_cleaned_and_then_as_it_was_said() {
    let cut = [
        ("включи эй мама", "мама", "эй мама"),
        ("включи talk talk", "talk", "talk talk"),
        ("включи малинки малинки", "малинки", "малинки малинки"),
        ("включи эм си хаммер", "си хаммер", "эм си хаммер"),
        ("включи а эс а пи рокки", "эс пи рокки", "а эс а пи рокки"),
        ("включи смотри гагариной", "гагариной", "смотри гагариной"),
        ("включи пет шоп бойз", "пет чтобы бойз", "пет шоп бойз"),
        ("поставь песню а я иду", "иду", "а я иду"),
        ("включи спасибо земфиры", "земфиры", "спасибо земфиры"),
        ("включи hey jude", "jude", "hey jude"),
        ("включи сто четыре дня", "104 дня", "сто четыре дня"),
        (
            "поставь группу алиса трасса е 95",
            "трасса е 95",
            "алиса трасса е 95",
        ),
    ];
    for (said, cleaned, name) in cut {
        let asked = heard(said);
        assert_eq!(asked[0], cleaned, "{said}");
        assert_eq!(asked[1], name, "{said}");
        let fuller = read(said, &[]).lookups()[0].fuller();
        assert!(fuller.iter().any(|text| text == name), "{said}: {fuller:?}");
    }
}

#[test]
fn what_says_more_than_the_name_is_asked_right_after_it_and_whatever_it_finds() {
    let fuller = [
        ("включи для тебя звери", "Звери", "для тебя звери"),
        ("поставь земфиру хочу", "Земфира", "земфиру хочу"),
        ("включи ну кино", "Кино", "ну кино"),
    ];
    for (said, name, whole) in fuller {
        let lookup = &read(said, &[]).lookups()[0];
        let texts = lookup.texts();
        assert_eq!(texts[0], name, "{said}");
        assert!(lookup.known(), "{said}");
        assert_eq!(lookup.fuller(), [whole], "{said}");
        let at = texts.iter().position(|text| text == whole);
        assert!(at.is_some_and(|at| at <= 2), "{said}: {texts:?}");
    }
    let plain = read("включи кино", &[]).lookups();
    assert_eq!(plain[0].fuller(), Vec::<String>::new());
}

#[test]
fn a_curated_artist_asked_for_as_another_kind_is_not_the_first_asked() {
    let other = [
        ("включи песню звери", "Звери"),
        ("включи альбом кино", "Кино"),
    ];
    for (said, name) in other {
        let lookup = &read(said, &[]).lookups()[0];
        let texts = lookup.texts();
        assert_ne!(texts[0], name, "{said}");
        assert!(!lookup.known(), "{said}");
        assert!(texts.iter().any(|text| text == name), "{said}: {texts:?}");
    }
    let lookup = &read("включи группу кино", &[]).lookups()[0];
    assert_eq!(lookup.texts()[0], "Кино");
    assert!(lookup.known());
}

#[test]
fn a_name_the_cleanup_leaves_whole_is_not_asked_twice() {
    let whole = [
        "включи кино",
        "включи бай бай бай",
        "включи ток ток",
        "включи пятьдесят оттенков серого",
        "включи скриптонита цепи",
    ];
    for said in whole {
        assert_eq!(kept(said), Vec::<String>::new(), "{said}");
    }
}

#[test]
fn a_polite_word_is_not_a_part_of_the_name() {
    let polite = [
        "включи пожалуйста кино",
        "включи кино пожалуйста",
        "включи земфиру спасибо",
        "включи плиз кино",
        "play nirvana please",
    ];
    for said in polite {
        assert_eq!(kept(said), Vec::<String>::new(), "{said}");
    }
}

#[test]
fn a_name_made_of_words_the_cleanup_drops_is_still_looked_up() {
    let dropped = [
        ("Алиса", "Алиса"),
        ("Спасибо", "спасибо"),
        ("hey", "hey"),
        ("Please Please Me", "please please me"),
    ];
    for (name, asked) in dropped {
        let readings = voice_resolve::named(name);
        let asked_as = readings[0].queries.iter().map(|v| v.text.as_str());
        let texts: Vec<&str> = asked_as.collect();
        assert!(texts.contains(&asked), "{name}: {texts:?}");
    }
}

#[test]
fn spoken_numbers_do_not_name_a_curated_artist_of_the_number_alone() {
    let lookups = read("включи сто четыре дня", &[]).lookups();
    let asked = lookups[0].variants.iter();
    let whole: Vec<&str> = asked
        .filter(|v| v.alias_kind.is_some() && v.title.is_none() && !v.fallback)
        .map(|v| v.text.as_str())
        .collect();
    assert_eq!(whole, Vec::<&str>::new());
}

#[test]
fn a_cut_name_ends_where_the_next_step_begins() {
    assert_eq!(kept("включи эй мама а потом кино"), ["эй мама"]);
    assert_eq!(kept("включи эй мама а потом включи ну погоди"), ["эй мама"]);
}

#[test]
fn a_cut_name_said_with_its_title_is_restored_in_its_part() {
    let titled = ["включи рио группы толк толк", "включи толк толк - рио"];
    for said in titled {
        let lookups = read(said, &[]).lookups();
        let mut asked = lookups[0].variants.iter();
        let restored = asked.find(|v| v.kept_fillers).expect(said);
        assert_eq!(restored.artist.as_deref(), Some("толк толк"), "{said}");
        assert_eq!(restored.title.as_deref(), Some("рио"), "{said}");
        assert_eq!(restored.text, "рио толк толк", "{said}");
    }
}

#[test]
fn every_curated_artist_is_asked_first_by_each_of_its_said_forms() {
    let rows = include_str!("../data/aliases.tsv").lines().skip(1);
    let artists = rows
        .map(|row| row.split('\t').collect::<Vec<_>>())
        .filter(|cols| cols[2] == "artist");
    for cols in artists {
        let readings = voice_resolve::named(cols[0]);
        let first = &readings[0].queries[0];
        assert_eq!(first.text, cols[1], "{}", cols[0]);
        assert_eq!(first.alias_kind, Some(Kind::Artist), "{}", cols[0]);
    }
}

#[test]
fn a_curated_name_of_a_part_of_the_phrase_is_asked_after_what_was_said() {
    let lookups = read("включи линкин парк намб", &[]).lookups();
    let asked: Vec<&str> = lookups[0]
        .variants
        .iter()
        .filter(|v| !v.fallback)
        .map(|v| v.text.as_str())
        .collect();
    assert_eq!(asked.first(), Some(&"линкин парк намб"), "{asked:?}");
    assert!(asked.contains(&"намб Linkin Park"), "{asked:?}");
}
