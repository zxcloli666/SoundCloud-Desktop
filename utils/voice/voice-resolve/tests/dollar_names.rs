use voice_nlu::{Kind, Names};
use voice_resolve::{
    Bare, Boosts, Catalog, Decision, FixtureCatalog, Lookup, interpret, matches, named,
};

fn first(rows: &str, name: &str) -> String {
    let catalog = FixtureCatalog::from_tsv(rows, true);
    let readings = named(name);
    let variants: Vec<_> = readings.iter().flat_map(|r| r.queries.clone()).collect();
    let found = catalog.candidates(&variants, &Kind::ALL);
    let ranked = matches(&readings, &found, &Kind::ALL, &Boosts::none());
    ranked[0].entity.label()
}

fn lookup_texts(name: &str) -> Vec<String> {
    let variants = named(name).into_iter().flat_map(|r| r.queries).collect();
    let lookup = Lookup {
        variants,
        kinds: Kind::ALL.to_vec(),
    };
    lookup.texts()
}

#[test]
fn a_dollar_name_finds_the_artist_stored_with_s() {
    let rows = "kind\tname\tartist\tpopularity\taliases
artist\tuicideboy\t\t42369\t
artist\tsuicideboys\t\t40678079\t
artist\t$ UICIDEBOY $\t\t1040\t
";
    assert_eq!(first(rows, "$uicideboy$"), "suicideboys");
}

#[test]
fn a_dollar_inside_a_name_finds_the_whole_name() {
    let rows = "kind\tname\tartist\tpopularity\taliases
artist\tha\t\t41018\t
artist\tKE\t\t79\t
artist\tKesha\t\t5000000\t
";
    assert_eq!(first(rows, "Ke$ha"), "Kesha");
    let rows = "kind\tname\tartist\tpopularity\taliases
artist\tTy Dolla Ign\t\t0\t
artist\tty dolla sign\t\t8745064\t
";
    assert_eq!(first(rows, "Ty Dolla $ign"), "ty dolla sign");
}

#[test]
fn a_name_stored_with_the_dollar_is_still_found() {
    let rows = "kind\tname\tartist\tpopularity\taliases
artist\tJoey Bada$$\t\t5427560\t
artist\tJoey Badass Fan\t\t120\t
";
    assert_eq!(first(rows, "Joey Bada$$"), "Joey Bada$$");
}

#[test]
fn the_server_gets_both_readings_among_the_first_eight_texts() {
    for (name, spelled, old) in [
        ("$uicideboy$", "suicideboys", "uicideboy"),
        ("Joey Bada$$", "joey badass", "joey bada"),
    ] {
        let texts = lookup_texts(name);
        assert_eq!(texts[0], spelled);
        assert!(
            texts[..8.min(texts.len())].contains(&old.to_string()),
            "{texts:?}"
        );
    }
}

#[test]
fn a_name_said_in_russian_reaches_the_artist_through_the_alias() {
    let rows = "kind\tname\tartist\tpopularity\taliases
artist\tsuicideboys\t\t40678079\t
artist\tuicideboy\t\t42369\t
";
    let catalog = FixtureCatalog::from_tsv(rows, true);
    let steps = interpret(
        "включи суисайдбойз",
        &catalog,
        &Boosts::none(),
        Bare::Certain,
        &Names::default(),
    );
    match &steps[0].decision {
        Some(Decision::Act { pick }) => assert_eq!(pick.entity.label(), "suicideboys"),
        other => panic!("not played: {other:?}"),
    }
}
