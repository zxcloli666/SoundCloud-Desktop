use super::ctx::Ctx;
use super::indirect;
use super::library::NOW_SET;
use crate::anchor::finite;
use crate::kin;
use crate::lexicon::{
    self, ABOUT, AGREEMENT, ASKING, ASKING_ANOTHER, BACKWARD, CLAUSE_SUBJECTS, COMPLAINT,
    COMPOUNDS, DEMONSTRATIVES, DENY, DESCRIBING, DOWN_WORDS, FED_UP, FIRST_PERSON, FORWARD,
    HEARING, IDLE, IN_TURN, INFINITIVE_ENDINGS, INSISTING, LISTENERS, LISTENING_STEMS, MAKING,
    MUSIC_STEMS, NEG_STEMS, NEXT_STRONG, NOISES, NOMINATIVE, NOT_NOW, OTHERS, OWN, PLAY_STRONG,
    POINTS_BACK, POORLY, PREV_STRONG, REMARK_START, RESUME_WORDS, ROUGHLY, SILENCE, SPEAKING,
    SPEECH, STRIDES, SWEARS_AMB, TASTE, THE_PAST, TO_THE_LISTENER, UP_WORDS, WAS, WHICH,
};

const RINGING: &[&str] = &["звонк", "будильник", "уведомлен", "телефон", "микрофон"];
const HEARD_LOUD: &[&str] = &["громко", "тихо", "loud", "quiet"];
const TOLD: &[&str] = &["tell", "ask"];
const TO_US: &[&str] = &["me", "us"];
const YOU_ARE: &[&str] = &["you", "youre", "im", "hes", "shes", "were", "theyre"];

pub fn threat_of_the_speaker(c: &Ctx) -> bool {
    let threat = |at: usize| lexicon::THREATS.contains(&c.at(at));
    (0..c.len()).any(|i| c.w[i] == "я" && (threat(i + 1) || threat(i + 2)))
}

pub fn sentence(c: &Ctx) -> bool {
    adverb_of_a_clause(c)
        || attribute_of_a_noun(c)
        || said_of_this_thing(c)
        || place_in_a_line(c)
        || half_of_a_compound(c)
        || complaint_about_a_thing(c)
        || taste_of_another(c)
        || thing_of_another(c)
        || thing_made_louder(c)
        || volume_of_a_thing(c)
        || radio_heard_loud(c)
        || threat_of_the_speaker(c)
        || said_in_english_to_someone(c)
        || question_with_its_own_verb(c)
        || question_to_a_person(c)
        || meant_for_someone_else(c)
        || order_passed_on(c)
        || music_as_a_topic(c)
        || silence_of_a_room(c)
        || plan_of_the_speaker(c)
        || voice_of_a_person(c)
        || speech_not_heard(c)
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
        let subject = CLAUSE_SUBJECTS.contains(&c.w[i]) || kin::subject(&c.w, i);
        let taken = subject || has_its_own_verb(&c.w[i..]);
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
        ordinal(adjective) && c.only_pre(0..i - 1) && agrees(adjective, noun) && own_noun(noun)
    })
}

fn said_of_this_thing(c: &Ctx) -> bool {
    (2..c.len()).any(|i| {
        let (this, noun, adjective) = (c.w[i - 2], c.w[i - 1], c.w[i]);
        let thing = own_noun(noun) && !lexicon::stem(MUSIC_STEMS, noun);
        DEMONSTRATIVES.contains(&this) && ordinal(adjective) && agrees(adjective, noun) && thing
    })
}

fn place_in_a_line(c: &Ctx) -> bool {
    let Some((last, before)) = c.w.split_last() else {
        return false;
    };
    let Some(who) = before.iter().position(|w| CLAUSE_SUBJECTS.contains(w)) else {
        return false;
    };
    let between = &before[who + 1..];
    ordinal(last)
        && NOMINATIVE.iter().any(|e| last.ends_with(e))
        && c.only_pre(0..who)
        && between.iter().all(|w| IN_TURN.contains(w))
}

fn ordinal(w: &str) -> bool {
    lexicon::stem(NEXT_STRONG, w) || lexicon::stem(PREV_STRONG, w)
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
        volume_word(c.w[i - 1]) && DENY.contains(&c.w[i]) && !lexicon::stem(NOISES, c.at(i + 1))
    })
}

fn volume_of_a_thing(c: &Ctx) -> bool {
    let rings = |w: &str| DENY.contains(&w) || lexicon::stem(RINGING, w);
    (1..c.len()).any(|i| lexicon::stem(lexicon::VOL_STEMS, c.w[i - 1]) && rings(c.w[i]))
}

fn radio_heard_loud(c: &Ctx) -> bool {
    let heard = c.has(HEARD_LOUD) || c.w.iter().any(|w| volume_word(w));
    c.has(&["радио", "radio"]) && heard && !c.has(PLAY_STRONG)
}

fn said_in_english_to_someone(c: &Ctx) -> bool {
    let passed_on = (1..c.len()).any(|i| TOLD.contains(&c.w[i - 1]) && !TO_US.contains(&c.w[i]));
    let muted_mic = c.has(&["mute", "muted"]) && c.has(&["on"]) && c.has(YOU_ARE);
    let hears_us = (1..c.len()).any(|i| c.w[i - 1] == "hear" && TO_US.contains(&c.w[i]));
    let asked_if_heard = c.has(&["hear", "heard"]) && matches!(c.at(0), "did" | "have");
    let another_thing = c.has(THINGS) && !c.has(PLAY_STRONG);
    let asks_you = c.at(0) == "do" && c.at(1) == "you" && YOUR_MIND.contains(&c.at(2));
    let asked = ASKED_FIRST.contains(&c.at(0)) || asks_you;
    let how_to = c.at(0) == "how" && HOW_TO.contains(&c.at(1)) && !c.has(&["use"]);
    let said_aside =
        comes_back(c) || left_unsaid(c) || plays_an_instrument(c) || best_way(c) || how_to;
    passed_on || muted_mic || hears_us || asked_if_heard || another_thing || asked || said_aside
}

fn comes_back(c: &Ctx) -> bool {
    let back = |at: usize| c.at(at) == "back" || (c.at(at) == "right" && c.at(at + 1) == "back");
    (0..c.len()).any(|at| c.w[at] == "be" && back(at + 1))
}

fn left_unsaid(c: &Ctx) -> bool {
    let open = c.w.last().is_some_and(|w| OPEN_ENDS.contains(w));
    let about = c.len() > 3 && !CLOSES.contains(&c.at(c.len() - 2));
    open && about && !c.has(ASKS_WHAT) && !c.has(PLAY_STRONG)
}

fn plays_an_instrument(c: &Ctx) -> bool {
    let named = c.len() > 3 && INSTRUMENTS.contains(&c.at(c.len() - 1));
    named && c.at(c.len() - 2) == "the" && c.has(PLAYERS)
}

fn best_way(c: &Ctx) -> bool {
    c.w.windows(2).any(|said| said == ["best", "way"])
}

const HOW_TO: &[&str] = &["do", "can", "to", "does", "would", "should"];
const OPEN_ENDS: &[&str] = &["is", "was", "are", "were"];
const CLOSES: &[&str] = &[
    "it", "this", "that", "there", "he", "she", "they", "you", "we", "i",
];
const ASKS_WHAT: &[&str] = &["what", "whats", "which", "who", "how"];
const PLAYERS: &[&str] = &["you", "i", "he", "she", "we", "they"];
const INSTRUMENTS: &[&str] = &[
    "piano",
    "guitar",
    "drums",
    "violin",
    "flute",
    "saxophone",
    "trumpet",
    "ukulele",
    "cello",
    "harmonica",
    "banjo",
    "bass",
    "keyboard",
];

const THINGS: &[&str] = &[
    "phone",
    "tv",
    "telly",
    "laptop",
    "computer",
    "tablet",
    "mic",
    "microphone",
    "headphones",
];
const ASKED_FIRST: &[&str] = &[
    "did", "does", "why", "was", "were", "has", "had", "should", "shall", "is", "are", "am",
];
const YOUR_MIND: &[&str] = &["want", "think", "know", "like", "hear"];

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

fn meant_for_someone_else(c: &Ctx) -> bool {
    let not = |at: usize| c.w[at] == "не";
    (1..c.len())
        .filter(|&i| TO_THE_LISTENER.contains(&c.w[i]))
        .any(|i| not(i - 1) || (i >= 2 && c.w[i - 1] == "с" && not(i - 2)))
}

fn order_passed_on(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let whom = c.w[i];
        let listener = TO_THE_LISTENER.contains(&whom);
        let deed = command_word(whom) || infinitive(whom);
        let third = POINTS_BACK.contains(&whom) || !(listener || deed);
        ASKING_ANOTHER.contains(&c.w[i - 1]) && third
    })
}

fn music_as_a_topic(c: &Ctx) -> bool {
    let asks = c.has(PLAY_STRONG) || c.w.iter().any(|w| volume_word(w));
    let named = |w: &str| command_word(w) || lexicon::stem(MUSIC_STEMS, w);
    !asks && (1..c.len()).any(|i| ABOUT.contains(&c.w[i - 1]) && named(c.w[i]))
}

fn silence_of_a_room(c: &Ctx) -> bool {
    c.has(SILENCE) && c.has(DESCRIBING)
}

fn plan_of_the_speaker(c: &Ctx) -> bool {
    let will_do = |w: &&str| (w.ends_with('у') || w.ends_with('ю')) && lexicon::stem(NEG_STEMS, w);
    let mine = c
        .pos(&["я"])
        .is_some_and(|at| c.only_pre(0..at) && c.w[at + 1..].iter().any(will_do));
    mine || plan_for_later(c)
}

fn plan_for_later(c: &Ctx) -> bool {
    let ours = |w: &&str| {
        let musical = lexicon::stem(NEG_STEMS, w) || lexicon::stem(LISTENING_STEMS, w);
        musical && FIRST_PERSON.iter().any(|e| w.ends_with(e))
    };
    c.has(NOT_NOW) && c.w.iter().any(ours)
}

fn voice_of_a_person(c: &Ctx) -> bool {
    let made = c.has(MAKING);
    c.has(SPEAKING) && !c.has(PLAY_STRONG) && !made && c.w.iter().any(|w| volume_word(w))
}

fn speech_not_heard(c: &Ctx) -> bool {
    let unheard =
        (1..c.len()).any(|i| POORLY.contains(&c.w[i - 1]) && lexicon::stem(HEARING, c.w[i]));
    let spoken = c.w.iter().any(|w| lexicon::stem(SPEECH, w) && finite(w));
    let asks = c.has(PLAY_STRONG) || c.has(MAKING) || c.w.iter().any(|w| volume_word(w));
    unheard && spoken && !asks
}

fn carrying_on_with_something_else(c: &Ctx) -> bool {
    (1..c.len()).any(|i| {
        let deed = c.w[i];
        let musical = command_word(deed) || lexicon::stem(NEG_STEMS, deed);
        RESUME_WORDS.contains(&c.w[i - 1]) && infinitive(deed) && !musical
    })
}

fn the_past(c: &Ctx) -> bool {
    c.has(THE_PAST) && !about_music(c) && !c.has(PLAY_STRONG)
}

fn infinitive(w: &str) -> bool {
    INFINITIVE_ENDINGS.iter().any(|e| w.ends_with(e))
}

fn own_verb(w: &str) -> bool {
    finite(w)
        && !command_word(w)
        && !NOW_SET.contains(&w)
        && !ROUGHLY.contains(&w)
        && !lexicon::stem(NEG_STEMS, w)
}

fn own_noun(w: &str) -> bool {
    !command_word(w)
        && !REMARK_START.contains(&w)
        && !COMPLAINT.contains(&w)
        && !FED_UP.contains(&w)
        && !WAS.contains(&w)
}

fn command_word(w: &str) -> bool {
    !DENY.contains(&w) && lexicon::ALL_LISTS.iter().any(|list| list.contains(&w))
}
