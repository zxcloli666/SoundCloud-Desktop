use super::ctx::Ctx;
use super::indirect;
use super::library::NOW_SET;
use crate::anchor::finite;
use crate::lexicon::{
    self, AGREEMENT, ASKING, BACKWARD, CLAUSE_SUBJECTS, COMPLAINT, COMPOUNDS, DEMONSTRATIVES, DENY,
    DOWN_WORDS, FORWARD, IDLE, INFINITIVE_ENDINGS, INSISTING, LISTENERS, LISTENING_STEMS,
    MUSIC_STEMS, NEG_STEMS, NEXT_STRONG, OTHERS, OWN, PLAY_STRONG, PREV_STRONG, REMARK_START,
    RESUME_WORDS, RINGS, ROUGHLY, SPEAKING, STRIDES, SWEARS_AMB, TASTE, THE_PAST, UP_WORDS, WAS,
    WHICH,
};

pub fn sentence(c: &Ctx) -> bool {
    adverb_of_a_clause(c)
        || attribute_of_a_noun(c)
        || half_of_a_compound(c)
        || complaint_about_a_thing(c)
        || taste_of_another(c)
        || thing_of_another(c)
        || thing_made_louder(c)
        || question_with_its_own_verb(c)
        || question_to_a_person(c)
        || plan_of_the_speaker(c)
        || voice_of_a_person(c)
        || carrying_on_with_something_else(c)
        || the_past(c)
}

pub fn marching(c: &Ctx) -> bool {
    let heading = c.has(FORWARD) || c.has(BACKWARD);
    heading && c.has(STRIDES) && !c.has(PLAY_STRONG)
}

fn adverb_of_a_clause(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let adverb = c.w[i - 1];
        let direction = FORWARD.contains(&adverb) || BACKWARD.contains(&adverb);
        let taken = CLAUSE_SUBJECTS.contains(&c.w[i]) || has_its_own_verb(&c.w[i..]);
        direction && taken && c.only_pre(0..i - 1) && !backs_the_command(&c.w[i..])
    })
}

fn has_its_own_verb(clause: &[&str]) -> bool {
    let verb = clause.iter().take(3).position(|w| own_verb(w));
    verb.is_some_and(|at| clause[..at].iter().all(|w| own_noun(w)))
}

fn backs_the_command(words: &[&str]) -> bool {
    let reason = |w: &&str| INSISTING.contains(w) || lexicon::stem(LISTENING_STEMS, w);
    words.iter().any(reason) || indirect::detect(&Ctx { w: words.to_vec() }).is_some()
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

fn complaint_about_a_thing(c: &Ctx) -> bool {
    complains(c) && !about_music(c) && !c.has(PLAY_STRONG) && names_a_thing(c, DEMONSTRATIVES)
}

fn complains(c: &Ctx) -> bool {
    c.w.iter()
        .any(|w| COMPLAINT.contains(w) && !SWEARS_AMB.contains(w))
}

fn about_music(c: &Ctx) -> bool {
    c.has_stem(MUSIC_STEMS)
}

fn names_a_thing(c: &Ctx, determiners: &[&str]) -> bool {
    (1..c.len()).any(|i| determiners.contains(&c.w[i - 1]) && own_noun(c.w[i]))
}

fn taste_of_another(c: &Ctx) -> bool {
    (c.has(TASTE) || complains(c)) && c.has(OTHERS) && !c.has(PLAY_STRONG)
}

fn thing_of_another(c: &Ctx) -> bool {
    let names_a_title = c.has(PLAY_STRONG) && !c.w.iter().any(|w| volume_word(w));
    !names_a_title && !about_music(c) && names_a_thing(c, OWN)
}

fn volume_word(w: &str) -> bool {
    UP_WORDS.contains(&w) || DOWN_WORDS.contains(&w)
}

fn thing_made_louder(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        volume_word(c.w[i - 1]) && DENY.contains(&c.w[i]) && !lexicon::stem(RINGS, c.at(i + 1))
    })
}

fn question_with_its_own_verb(c: &Ctx) -> bool {
    let Some(at) = c.pos(WHICH) else {
        return false;
    };
    !c.has(PLAY_STRONG) && c.w[at + 1..].iter().any(|w| own_verb(w))
}

fn question_to_a_person(c: &Ctx) -> bool {
    !c.has(PLAY_STRONG)
        && (2..c.len()).any(|i| {
            let deed = c.w[i..].iter().find(|w| own_verb(w));
            ASKING.contains(&c.w[i - 2])
                && LISTENERS.contains(&c.w[i - 1])
                && deed.is_some_and(|w| !IDLE.contains(w))
        })
}

fn plan_of_the_speaker(c: &Ctx) -> bool {
    let Some(at) = c.pos(&["я"]) else {
        return false;
    };
    let will_do = |w: &&str| (w.ends_with('у') || w.ends_with('ю')) && lexicon::stem(NEG_STEMS, w);
    c.only_pre(0..at) && c.w[at + 1..].iter().any(will_do)
}

fn voice_of_a_person(c: &Ctx) -> bool {
    c.has(SPEAKING) && !c.has(PLAY_STRONG) && c.w.iter().any(|w| volume_word(w))
}

fn carrying_on_with_something_else(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let deed = c.w[i];
        let infinitive = INFINITIVE_ENDINGS.iter().any(|e| deed.ends_with(e));
        let musical = command_word(deed) || lexicon::stem(NEG_STEMS, deed);
        RESUME_WORDS.contains(&c.w[i - 1]) && infinitive && !musical
    })
}

fn the_past(c: &Ctx) -> bool {
    c.has(THE_PAST) && !about_music(c) && !c.has(PLAY_STRONG)
}

fn own_verb(w: &str) -> bool {
    finite(w)
        && !command_word(w)
        && !NOW_SET.contains(&w)
        && !ROUGHLY.contains(&w)
        && !lexicon::stem(NEG_STEMS, w)
}

fn own_noun(w: &str) -> bool {
    !command_word(w) && !REMARK_START.contains(&w) && !COMPLAINT.contains(&w) && !WAS.contains(&w)
}

fn command_word(w: &str) -> bool {
    !DENY.contains(&w) && lexicon::ALL_LISTS.iter().any(|list| list.contains(&w))
}
