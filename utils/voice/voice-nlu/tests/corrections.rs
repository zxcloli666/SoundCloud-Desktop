use voice_nlu::{Intent, Names, Parsed};

fn read(text: &str) -> Vec<Parsed> {
    voice_nlu::parse(text, &Names::default())
}

fn steps(text: &str) -> Vec<&'static str> {
    read(text).iter().map(|p| p.intent.name()).collect()
}

fn one(text: &str) -> Parsed {
    let mut said = read(text);
    assert_eq!(said.len(), 1, "{text}");
    said.remove(0)
}

fn asks_for(p: &Parsed, name: &str) -> bool {
    p.queries.iter().any(|q| q.text == name)
}

fn mentions(p: &Parsed, part: &str) -> bool {
    p.queries.iter().any(|q| q.text.contains(part))
}

#[test]
fn a_spat_out_word_starts_the_new_version() {
    let p = one("включи дрейка тьфу ты дору");
    assert_eq!(p.intent, Intent::Play);
    assert!(asks_for(&p, "дору"));
    assert!(!mentions(&p, "дрейк"));
    assert_eq!(steps("следующий тьфу предыдущий"), ["previous"]);
    assert_eq!(steps("сделай громче тьфу ты тише"), ["volume_down"]);
    let p = one("громкость на тридцать тьфу на сорок");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(40)));
}

#[test]
fn at_least_is_not_a_change_of_mind() {
    let p = one("громкость на тридцать хотя бы");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(30)));
    let p = one("громкость на двадцать а нет на сорок хотя бы");
    assert_eq!((p.intent, p.number), (Intent::VolumeSet, Some(40)));
    assert_eq!(steps("включи хотя бы что-нибудь"), ["play_wave"]);
    assert_eq!(steps("сделай хотя бы потише"), ["volume_down"]);
    assert_eq!(steps("громче хотя нет тише"), ["volume_down"]);
}
