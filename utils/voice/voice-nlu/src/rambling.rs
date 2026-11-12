use crate::anchor::{self, Found};
use crate::intent::{self, Detected, Negation};
use crate::lexicon::{
    self, ATTENTION, COMPLAINT, DENY, DOWN_WORDS, FED_UP, GENERIC, HELLO_ON_THE_PHONE, IMPERATIVES,
    NEG_STEMS, OBJECT_VERBS, PLAY_STRONG, PLAY_WEAK, PLAYER, PRE, REASON, REMARK_START, REPORT,
    RESUME_FILL, RESUME_WORDS, ROOM, TIME_SPANS, UP_WORDS, WARNING,
};
use crate::normalize::Tok;
use crate::numbers;
use crate::slots::kind_of;
use crate::types::Intent;

struct Clause<'a> {
    head: &'a [Tok],
    said: &'a [Tok],
    tail: &'a [Tok],
}

pub fn find(toks: &[Tok]) -> Option<Found> {
    if intent::lyric(toks) || intent::indirect_hit(toks) {
        return None;
    }
    let whole = intent::detect(toks);
    if whole.blocked || !matches!(whole.intent, Intent::None | Intent::Play) {
        return None;
    }
    let mut verbs = (0..toks.len()).filter(|&i| addressed(&toks[i].w));
    verbs.find_map(|verb| around(toks, verb))
}

fn around(toks: &[Tok], verb: usize) -> Option<Found> {
    let lead = said_before(toks, verb);
    let starts = [Some(lead), (lead < verb).then_some(verb)];
    let commanded = commands(&toks[..verb]);
    for start in starts.into_iter().flatten() {
        let follows = start == verb && !PLAY_STRONG.contains(&toks[verb].w.as_str());
        if (start > 0 && commanded) || !talk(&toks[..start], follows) {
            continue;
        }
        for end in (verb + 1..=toks.len()).rev() {
            if start == 0 && end == toks.len() {
                continue;
            }
            let clause = Clause {
                head: &toks[..start],
                said: &toks[start..end],
                tail: &toks[end..],
            };
            let det = intent::detect(clause.said);
            if !det.blocked && fits(&clause, &det) && affirmed(toks, end, &clause) {
                return Some(Found {
                    window: clause.said.to_vec(),
                    det,
                });
            }
        }
    }
    None
}

fn addressed(w: &str) -> bool {
    let command = OBJECT_VERBS.contains(&w)
        || PLAY_STRONG.contains(&w)
        || UP_WORDS.contains(&w)
        || DOWN_WORDS.contains(&w)
        || matches!(w, "давай" | "давайте");
    command && ORDER_ENDINGS.iter().any(|e| w.ends_with(e)) && !w.ends_with("ть")
}

const ORDER_ENDINGS: &[&str] = &["и", "й", "ь", "те"];

fn said_before(toks: &[Tok], verb: usize) -> usize {
    let command_word = |t: &Tok| {
        let w = t.w.as_str();
        (lexicon::is_known(w) || numbers::is_number(w)) && !addressed(w)
    };
    let run = (0..verb).rev().take_while(|&i| command_word(&toks[i]));
    run.last().unwrap_or(verb)
}

fn commands(before: &[Tok]) -> bool {
    let said = intent::detect(before);
    let asked = said.intent != Intent::None && !said.intent.needs_entity();
    let hinted = intent::indirect_hit(before) || fed_up(before);
    (said.blocked && !fed_up(before)) || (asked && !hinted)
}

fn talk(head: &[Tok], command_follows: bool) -> bool {
    let foreign = |t: &Tok| ROOM.contains(&t.w.as_str()) || addressed(&t.w);
    let last = head.last().map_or("", |t| t.w.as_str());
    (head.is_empty() || statement(head, command_follows))
        && !head.iter().any(foreign)
        && !reported(head)
        && !matches!(last, "не" | "ни" | "такой" | "такая")
        && !(DENY.contains(&last) && !lasted(head))
}

fn lasted(head: &[Tok]) -> bool {
    let span = head.len().checked_sub(2).map(|at| head[at].w.as_str());
    span.is_some_and(|w| TIME_SPANS.contains(&w))
}

fn statement(head: &[Tok], command_follows: bool) -> bool {
    let about = |w: &str| REMARK_START.contains(&w) || matches!(w, "ты" | "этот" | "эту");
    let told = |w: &str| command_follows && anchor::finite(w);
    let said = head
        .iter()
        .any(|t| about(&t.w) || calls(&t.w) || told(&t.w));
    said || intent::indirect_hit(head)
}

fn calls(w: &str) -> bool {
    let attention = ATTENTION.contains(&w) || HELLO_ON_THE_PHONE.contains(&w);
    attention || COMPLAINT.contains(&w) || FED_UP.contains(&w)
}

fn reported(head: &[Tok]) -> bool {
    let insisting = |i: usize| i >= 2 && head[i - 2].w == "я" && head[i - 1].w == "же";
    (0..head.len()).any(|i| REPORT.contains(&head[i].w.as_str()) && !insisting(i))
}

fn fits(c: &Clause, det: &Detected) -> bool {
    let resumes = |t: &Tok| RESUME_WORDS.contains(&t.w.as_str());
    match det.intent {
        Intent::Play => named(c, det),
        Intent::PlayWave | Intent::PlayLikes => {
            c.said.len() > 1 && (c.tail.is_empty() || reason(c.tail))
        }
        Intent::Undo => c.said.len() > 1 && remark(c, det.intent),
        Intent::Resume if !c.said.iter().any(resumes) => false,
        i if anchor::allowed(i) => {
            let complained = complained(c.head, i) && !denied(c.head);
            let about_playback = specific(c.said) || complained;
            (c.head.is_empty() || about_playback) && remark(c, i)
        }
        _ => false,
    }
}

fn named(c: &Clause, det: &Detected) -> bool {
    let first = c.said[0].w.as_str();
    let asked = if det.weak {
        PLAY_WEAK.contains(&first) && listening(c.head)
    } else {
        IMPERATIVES.contains(&first) && fed_up(c.head)
    };
    asked && !c.head.is_empty() && c.tail.is_empty()
}

fn listening(head: &[Tok]) -> bool {
    head.iter()
        .any(|t| PLAY_STRONG.contains(&t.w.as_str()) && t.w.ends_with("ть"))
}

fn complained(head: &[Tok], asked: Intent) -> bool {
    let foreign = |t: &Tok| !(lexicon::is_known(&t.w) || calls(&t.w));
    let tired = fed_up(head) && (asked == Intent::Next || !head.iter().any(foreign));
    let same = intent::indirect_hit(head) && intent::detect(head).intent == asked;
    tired || same || had_enough(head) || head.iter().any(player)
}

fn specific(said: &[Tok]) -> bool {
    let filling = |w: &str| PRE.contains(&w) || GENERIC.contains(&w) || RESUME_FILL.contains(&w);
    let meant = said.iter().filter(|t| !filling(&t.w)).count();
    meant > 1 || said.iter().any(player)
}

fn player(t: &Tok) -> bool {
    let w = t.w.as_str();
    let named = kind_of(w).is_some() || UP_WORDS.contains(&w) || DOWN_WORDS.contains(&w);
    (named || lexicon::stem(PLAYER, w)) && !addressed(w)
}

fn fed_up(words: &[Tok]) -> bool {
    had_enough(words) || words.iter().any(|t| COMPLAINT.contains(&t.w.as_str()))
}

fn had_enough(words: &[Tok]) -> bool {
    words.iter().any(|t| FED_UP.contains(&t.w.as_str()))
}

fn reason(tail: &[Tok]) -> bool {
    let that_which = tail.len() > 1 && tail[0].w == "то" && tail[1].w == "что";
    REASON.contains(&tail[0].w.as_str()) && !that_which && !denied(tail)
}

fn denied(tail: &[Tok]) -> bool {
    tail.iter().any(|t| DENY.contains(&t.w.as_str()))
}

fn remark(c: &Clause, intent: Intent) -> bool {
    let tail = c.tail;
    if tail.is_empty() {
        return true;
    }
    !denied(tail)
        && (forbids_other(c)
            || anchor::urges(tail)
            || fed_up(tail)
            || intent::detect(tail).intent == intent
            || anchor::tail_ok(tail, c.said)
            || (intent == Intent::Undo && anchor::remark_after(tail, c.said)))
}

fn forbids_other(c: &Clause) -> bool {
    let padding = |t: &Tok| WARNING.contains(&t.w.as_str());
    let Some(not) = c.tail.iter().position(|t| t.w == "не") else {
        return false;
    };
    let Some((verb, after)) = c.tail[not + 1..].split_first() else {
        return false;
    };
    let mut stems = NEG_STEMS.iter().filter(|stem| verb.w.starts_with(**stem));
    let same_action = |stem: &str| c.said.iter().any(|t| t.w.contains(stem));
    c.tail[..not].iter().all(padding)
        && after.iter().all(padding)
        && lexicon::stem(NEG_STEMS, &verb.w)
        && !stems.any(|stem| same_action(stem))
}

fn affirmed(toks: &[Tok], end: usize, c: &Clause) -> bool {
    let clear = |words: &[Tok]| matches!(intent::negation(words), Negation::Clear);
    clear(&toks[..end]) && (clear(c.tail) || forbids_other(c))
}
