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
