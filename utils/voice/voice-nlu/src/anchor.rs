use crate::intent::{self, Detected};
use crate::kin;
use crate::lexicon::{
    self, ABOUT_OWN_WORDS, ASKS_TO_TALK, BLOCK_HEAD, BLOCK_TAIL, DENY, DOWN_WORDS, FED_UP,
    HELLO_ON_THE_PHONE, IDLE, INSISTING, LISTENERS, NEXT_STRONG, OBJECT_VERBS, ORDER_ENDINGS,
    PAUSE_WORDS, PLAY_STRONG, PLAY_WEAK, PLAYER, PREV_STRONG, STOP_WORDS, SUBJECTS, TAIL_REMARK,
    TO_THE_LISTENER,
};
use crate::normalize::Tok;
use crate::types::Intent;

pub struct Found {
    pub window: Vec<Tok>,
    pub det: Detected,
}

pub fn allowed(i: Intent) -> bool {
    !matches!(
        i,
        Intent::None
            | Intent::Play
            | Intent::QueueAdd
            | Intent::PlaySimilar
            | Intent::PlayWave
            | Intent::PlayLikes
            | Intent::Help
            | Intent::Undo
    )
}

pub fn finite(w: &str) -> bool {
    VERB_ENDINGS.iter().any(|e| w.ends_with(e))
}

fn head_intent(i: Intent) -> bool {
    matches!(
        i,
        Intent::Play | Intent::PlayWave | Intent::PlayLikes | Intent::PlaySimilar
    )
}

fn head_ok(head: &[Tok], window: &[Tok], tail: &[Tok]) -> bool {
    let answered = |t: &Tok| SUBJECTS.contains(&t.w.as_str()) && t.w != "я";
    let insists = window[0].w != "не" && !tail.iter().any(answered);
    let last_word = tail.is_empty() && bare_command_word(window);
    let head = if insists {
        before_insisting(head, last_word)
    } else {
        head
    };
    let hushed = window.iter().any(|t| {
        let w = t.w.as_str();
        DOWN_WORDS.contains(&w) || PAUSE_WORDS.contains(&w) || STOP_WORDS.contains(&w)
    });
    head.len() <= 4
        && (0..head.len()).all(|at| {
            let w = head[at].w.as_str();
            let resting = hushed && at + 1 == head.len() && RESTING.contains(&w);
            let told = HELLO_ON_THE_PHONE.contains(&w) || kin::told_of(head, at) || resting;
            !BLOCK_HEAD.contains(&w)
                && !kin::called(head, at)
                && !PLAY_STRONG.contains(&w)
                && !DENY.contains(&w)
                && (!finite(w) || told)
                && !single_command(&head[at])
        })
}

fn bare_command_word(window: &[Tok]) -> bool {
    let [said] = window else {
        return false;
    };
    let w = said.w.as_str();
    let ordinal = lexicon::stem(NEXT_STRONG, w) || lexicon::stem(PREV_STRONG, w);
    let verb = ORDER_ENDINGS.iter().any(|e| w.ends_with(e)) || FED_UP.contains(&w);
    let halt = STOP_WORDS.contains(&w) || PAUSE_WORDS.contains(&w);
    ordinal || (halt && !verb)
}

fn before_insisting(head: &[Tok], last_word: bool) -> &[Tok] {
    let to_you = head
        .last()
        .is_some_and(|t| TO_THE_LISTENER.contains(&t.w.as_str()));
    let said = &head[..head.len() - usize::from(to_you)];
    let Some((verb, rest)) = said.split_last() else {
        return head;
    };
    let between = rest
        .iter()
        .rev()
        .take_while(|t| ABOUT_OWN_WORDS.contains(&t.w.as_str()))
        .count();
    let me = rest.len().checked_sub(between + 1);
    let Some(at) = me.filter(|&at| rest[at].w == "я") else {
        return head;
    };
    let listener = head[..at].iter().any(|t| LISTENERS.contains(&t.w.as_str()));
    let again = to_you || last_word || between > 0 || listener;
    if INSISTING.contains(&verb.w.as_str()) && again {
        &head[..at]
    } else {
        head
    }
}

const RESTING: &[&str] = &[
    "спит",
    "спят",
    "уснул",
    "уснула",
    "уснули",
    "засыпает",
    "засыпают",
    "отдыхает",
    "отдыхают",
];

const VERB_ENDINGS: &[&str] = &[
    "ет", "ит", "ют", "ут", "ат", "ят", "ешь", "ишь", "ем", "им", "ете", "ите", "ал", "ала", "ел",
    "ела", "ил", "ила", "ли", "ло", "ся", "сь", "ёл",
];

fn single_command(t: &Tok) -> bool {
    let one = std::slice::from_ref(t);
    !intent::indirect_hit(one) && intent::detect(one).intent != Intent::None
}

const SAID_ALONE: &[&str] = &["паузе", lexicon::HALT];
const SUMMONS: &[&str] = &["иди", "идите", "подойди", "подойдите"];

pub fn tail_ok(tail: &[Tok], window: &[Tok]) -> bool {
    let last = window.last().map(|t| t.w.as_str()).unwrap_or("");
    let about_the_tail = !tail.is_empty() && (oblique_ordinal(last) || SAID_ALONE.contains(&last));
    !about_the_tail && (urges(tail) || (!BLOCK_TAIL.contains(&last) && remark_after(tail, window)))
}

fn oblique_ordinal(w: &str) -> bool {
    let ordinal = lexicon::stem(NEXT_STRONG, w) || lexicon::stem(PREV_STRONG, w);
    ordinal && OBLIQUE_ENDINGS.iter().any(|e| w.ends_with(e))
}

const OBLIQUE_ENDINGS: &[&str] = &[
    "ем", "ом", "им", "ым", "ему", "ому", "его", "ого", "ими", "ыми", "их", "ых",
];

pub fn urges(tail: &[Tok]) -> bool {
    let Some(first) = tail.first() else {
        return false;
    };
    let asks = matches!(first.w.as_str(), "что" | "чего");
    let you = usize::from(tail.get(1).is_some_and(|t| t.w == "ты"));
    asks && tail.len() == you + 2 && IDLE.contains(&tail[you + 1].w.as_str())
}

pub fn remark_after(tail: &[Tok], window: &[Tok]) -> bool {
    let (Some(first), Some(last_tail)) = (tail.first(), tail.last()) else {
        return true;
    };
    let w = first.w.as_str();
    let own = w == "у"
        && tail
            .get(1)
            .is_some_and(|t| matches!(t.w.as_str(), "меня" | "нас"));
    if own {
        return tail.iter().all(|t| !DENY.contains(&t.w.as_str()));
    }
    if tail.len() == 1 && w == "было" {
        return true;
    }
    if tail.len() > 8 || BLOCK_TAIL.contains(&w) || kin::ordered_to(window, tail) {
        return false;
    }
    let remark = TAIL_REMARK.contains(&w) || kin::kin(w);
    let transitive = window.iter().any(|t| OBJECT_VERBS.contains(&t.w.as_str()));
    let denied = transitive && tail.iter().any(|t| DENY.contains(&t.w.as_str()));
    let object = window.iter().any(|t| lexicon::stem(PLAYER, &t.w));
    if denied
        || tail
            .iter()
            .any(|t| t.w == "не" || t.w == "нет" || single_command(t))
    {
        return !denied && remark;
    }
    if remark || tail.iter().any(|t| SUMMONS.contains(&t.w.as_str())) {
        return true;
    }
    let praise = tail.len() >= 2 && lexicon::KIND_TRACK.contains(&last_tail.w.as_str());
    let finite = tail.len() >= 2 && finite(&last_tail.w);
    praise || (finite && (!transitive || object))
}

fn answers_a_call(head: &[Tok], asked: Intent) -> bool {
    let hello = head
        .iter()
        .any(|t| HELLO_ON_THE_PHONE.contains(&t.w.as_str()));
    hello && asked == Intent::NowPlaying
}

fn asks_to_talk(head: &[Tok], window: &[Tok]) -> bool {
    let said = |words: &[&str], toks: &[Tok]| toks.iter().any(|t| words.contains(&t.w.as_str()));
    said(ASKS_TO_TALK, head) && !said(PLAY_STRONG, window) && !said(PLAY_WEAK, window)
}

pub fn find(toks: &[Tok]) -> Option<Found> {
    let n = toks.len();
    if !(2..=12).contains(&n) {
        return None;
    }
    for len in (1..n).rev() {
        for start in 0..=n - len {
            let end = start + len;
            let (head, window, tail) = (&toks[..start], &toks[start..end], &toks[end..]);
            if !head_ok(head, window, tail) || !tail_ok(tail, window) {
                continue;
            }
            let det = intent::detect(window);
            if answers_a_call(head, det.intent) {
                continue;
            }
            let head_only = end == n && start > 0 && head_intent(det.intent);
            if head_only && asks_to_talk(head, window) {
                continue;
            }
            if (allowed(det.intent) || head_only) && !det.blocked {
                return Some(Found {
                    window: window.to_vec(),
                    det,
                });
            }
        }
    }
    None
}
