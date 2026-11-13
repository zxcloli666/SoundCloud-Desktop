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
