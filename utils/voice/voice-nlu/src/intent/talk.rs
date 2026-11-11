use super::ctx::Ctx;
use crate::anchor::finite;
use crate::lexicon::{self, BACKWARD, CLAUSE_SUBJECTS, FORWARD};

pub fn sentence(c: &Ctx) -> bool {
    adverb_of_a_clause(c)
}

fn adverb_of_a_clause(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let adverb = c.w[i - 1];
        let direction = FORWARD.contains(&adverb) || BACKWARD.contains(&adverb);
        direction && c.only_pre(0..i - 1) && (CLAUSE_SUBJECTS.contains(&c.w[i]) || own_verb(c.w[i]))
    })
}

fn own_verb(w: &str) -> bool {
    finite(w) && !lexicon::is_known(w)
}
