use crate::intent::{self, Negation};
use crate::normalize::{normalize, words};

const NOT: &str = "не";
const NO: &str = "нет";

pub fn command_after(text: &str) -> Option<String> {
    let said = words(text);
    after_a_no(text)
        .or_else(|| instead_of_the_denied(text))
        .or_else(|| after_a_run_of_no(&said))
}

fn after_a_no(text: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let mut said = lower.split_whitespace();
    let first = said.next()?;
    let rest: Vec<&str> = said.collect();
    (matches!(first, "не," | "нет," | "не.") && !rest.is_empty()).then(|| rest.join(" "))
}

fn instead_of_the_denied(text: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let said: Vec<&str> = lower.split_whitespace().collect();
    if said.first() != Some(&NOT) || said.len() < 3 {
        return None;
    }
    let cut = said.iter().position(|w| matches!(*w, "а" | "а,"))?;
    (cut + 1 < said.len()).then(|| said[cut + 1..].join(" "))
}

fn after_a_run_of_no(said: &[String]) -> Option<String> {
    let run = said.iter().take_while(|w| *w == NOT || *w == NO).count();
    let rest = said[run..].join(" ");
    let negated = || refuses(&format!("{NOT} {rest}"));
    (run >= 2 && !rest.is_empty() && !negated()).then(|| format!("{NO} {rest}"))
}

fn refuses(said: &str) -> bool {
    !matches!(intent::negation(&normalize(said).toks), Negation::Clear)
}
