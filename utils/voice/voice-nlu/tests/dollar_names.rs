use voice_nlu::{fold, parse_name};

fn texts(name: &str) -> Vec<String> {
    let parsed = parse_name(name);
    parsed.queries.iter().map(|q| q.text.clone()).collect()
}

#[test]
fn a_dollar_in_a_name_folds_as_the_letter_s() {
    assert_eq!(fold("$uicideboy$"), fold("suicideboys"));
    assert_eq!(fold("Ke$ha"), fold("Kesha"));
    assert_eq!(fold("A$AP Rocky"), fold("Asap Rocky"));
    assert_eq!(fold("Ty Dolla $ign"), fold("Ty Dolla Sign"));
}

#[test]
fn a_dollar_next_to_digits_or_spaces_folds_as_before() {
    assert_eq!(fold("100$"), fold("100"));
    assert_eq!(fold("$100"), fold("100"));
    assert_eq!(fold("$ UICIDEBOY $"), fold("uicideboy"));
}

#[test]
fn a_name_with_a_dollar_looks_up_the_spelled_reading_first_and_the_old_one_after() {
    let found = texts("$uicideboy$");
    assert_eq!(found[0], "suicideboys");
    assert!(found.iter().any(|t| t == "uicideboy"), "{found:?}");
    let found = texts("Joey Bada$$");
    assert_eq!(found[0], "joey badass");
    assert!(found.iter().any(|t| t == "joey bada"), "{found:?}");
}

#[test]
fn a_dollar_next_to_digits_is_read_as_before() {
    assert_eq!(texts("100$ club"), texts("100 club"));
}
