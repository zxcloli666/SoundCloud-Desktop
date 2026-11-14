use voice_g2p::en::{English, Lexicon};

#[test]
fn english_numbers_and_words() {
    let en = English::new(Lexicon::bundled());
    let p = en.phonemize("Play 3 songs at 5:30, volume 50%.");
    assert!(p.unknown.is_empty(), "{:?}", p.unknown);
    assert!(p.text.contains("θɹˈi"), "{}", p.text);
    assert!(p.text.ends_with('.'));
    let year = en.phonemize("In 1999 the 21st song");
    assert!(year.unknown.is_empty(), "{:?}", year.unknown);
}
