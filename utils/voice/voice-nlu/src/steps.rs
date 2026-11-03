use crate::normalize::normalize;
use crate::parse_toks;
use crate::types::Parsed;

pub fn parse(text: &str) -> Vec<Parsed> {
    let toks = normalize(text).toks;
    vec![parse_toks(text, toks).0]
}
