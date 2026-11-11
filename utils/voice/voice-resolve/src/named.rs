use voice_nlu::{Names, Parsed, parse};

use crate::catalog::Catalog;
use crate::score::Boosts;
use crate::{WHOLE_NAME_MIN, ranked};

pub(crate) fn reading(
    text: &str,
    names: &Names,
    catalog: &dyn Catalog,
    boosts: &Boosts,
) -> Vec<Parsed> {
    let without = parse(text, names);
    let looks_up = |p: &Parsed| !p.queries.is_empty() || !p.alt.is_empty();
    if !names.in_doubt(text) || !without.iter().any(looks_up) {
        return without;
    }
    let whole = parse(text, &Names::default());
    let sure = |p: &Parsed| {
        let best = || ranked(p, catalog, boosts).into_iter().next();
        !p.queries.is_empty() && best().is_some_and(|hit| hit.sim >= WHOLE_NAME_MIN)
    };
    if whole.iter().any(sure) {
        whole
    } else {
        without
    }
}
