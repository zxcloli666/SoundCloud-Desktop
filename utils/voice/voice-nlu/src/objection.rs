use crate::intent::{self, Negation};
use crate::kin;
use crate::lexicon::{self, REMARK_START};
use crate::normalize::{normalize, words};
use crate::types::Intent;

const NOT: &str = "не";
const NO: &str = "нет";
const JUST: &str = "просто";
const ASKED: &[&str] = &[
    "просил",
    "просила",
    "говорил",
    "говорила",
    "сказал",
    "сказала",
    "велел",
    "велела",
];
const ASKED_BY: usize = 2;
const BUT: &str = "but";
const CONCEDED_BY: usize = 6;

pub fn command_after(text: &str) -> Option<String> {
    let said = words(text);
    after_a_no(text)
        .or_else(|| instead_of_the_denied(text))
        .or_else(|| after_a_run_of_no(&said))
        .or_else(|| instead_of_the_refused(&said))
        .or_else(|| after_what_was_not_asked(&said))
        .or_else(|| after_a_concession(&said))
}

fn after_a_concession(said: &[String]) -> Option<String> {
    let but = said.iter().position(|w| w == BUT)?;
    let asks = |said: &[String]| {
        let text = said.join(" ");
        let (read, blocked) = crate::parse_toks(&text, normalize(&text).toks);
        read.intent != Intent::None && !blocked
    };
    let rest = &said[but + 1..];
    let conceded = (1..=CONCEDED_BY).contains(&but) && !asks(&said[..but]);
    (conceded && asks(rest)).then(|| rest.join(" "))
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
    let no = said.first().filter(|w| *w == NOT || *w == NO)?;
    let run = said.iter().take_while(|w| *w == no).count();
    let rest = said[run..].join(" ");
    let protest = said.get(run).is_some_and(|w| lexicon::whole_command(w));
    let negated = || !protest && refuses(&format!("{NOT} {rest}"));
    (run >= 2 && !rest.is_empty() && !negated()).then(|| format!("{NO} {NO} {rest}"))
}

fn instead_of_the_refused(said: &[String]) -> Option<String> {
    let just = said.iter().position(|w| w == JUST)?;
    let refused = refuses(&said[..just].join(" "));
    let remark = said[just..]
        .iter()
        .any(|w| REMARK_START.contains(&w.as_str()) || kin::kin(w));
    (refused && !remark && just + 1 < said.len()).then(|| said[just..].join(" "))
}

fn after_what_was_not_asked(said: &[String]) -> Option<String> {
    let asked = said.iter().position(|w| ASKED.contains(&w.as_str()))?;
    if asked == 0 || asked > ASKED_BY || said[asked - 1] != NOT {
        return None;
    }
    let command = (asked + 2..said.len()).find(|&at| intent::orders(&said[at]))?;
    Some(said[command..].join(" "))
}

fn refuses(said: &str) -> bool {
    !matches!(intent::negation(&normalize(said).toks), Negation::Clear)
}
