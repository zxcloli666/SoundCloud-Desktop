use super::ctx::Ctx;
use super::indirect;
use crate::anchor::finite;
use crate::lexicon::{
    self, AGREEMENT, BACKWARD, CLAUSE_SUBJECTS, COMPLAINT, COMPOUNDS, FORWARD, NEXT_STRONG,
    PLAY_STRONG, PREV_STRONG, REMARK_START,
};

pub fn sentence(c: &Ctx) -> bool {
    adverb_of_a_clause(c) || attribute_of_a_noun(c) || half_of_a_compound(c)
}

fn adverb_of_a_clause(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let adverb = c.w[i - 1];
        let direction = FORWARD.contains(&adverb) || BACKWARD.contains(&adverb);
        let taken = CLAUSE_SUBJECTS.contains(&c.w[i]) || own_verb(c.w[i]);
        direction && taken && c.only_pre(0..i - 1) && !asks_by_itself(&c.w[i..])
    })
}

fn asks_by_itself(words: &[&str]) -> bool {
    indirect::detect(&Ctx { w: words.to_vec() }).is_some()
}

fn attribute_of_a_noun(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let (adjective, noun) = (c.w[i - 1], c.w[i]);
        let ordinal =
            lexicon::stem(NEXT_STRONG, adjective) || lexicon::stem(PREV_STRONG, adjective);
        ordinal && c.only_pre(0..i - 1) && agrees(adjective, noun) && own_noun(noun)
    })
}

fn agrees(adjective: &str, noun: &str) -> bool {
    let last = noun.chars().last();
    AGREEMENT.iter().any(|(endings, letters)| {
        endings.iter().any(|e| adjective.ends_with(e)) && last.is_some_and(|l| letters.contains(l))
    })
}

fn half_of_a_compound(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let joined = COMPOUNDS
            .iter()
            .any(|(head, tails)| c.w[i - 1] == *head && lexicon::stem(tails, c.w[i]));
        joined && !c.w[..i - 1].iter().any(|w| PLAY_STRONG.contains(w))
    })
}

fn own_verb(w: &str) -> bool {
    finite(w) && !command_word(w)
}

fn own_noun(w: &str) -> bool {
    !command_word(w) && !REMARK_START.contains(&w) && !COMPLAINT.contains(&w)
}

fn command_word(w: &str) -> bool {
    lexicon::ALL_LISTS.iter().any(|list| list.contains(&w))
}
