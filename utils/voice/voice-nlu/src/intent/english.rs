use super::indirect::{Rule, rule};
use crate::types::Intent;

const TOO: &[&str] = &["to", "too", "so", "way"];
const RATHER: &[&str] = &["bit", "little", "kinda", "pretty", "quite", "rather"];
const ITS_SAID: &[&str] = &["its", "is", "thats", "getting", "a", "in", "here"];
const ITS: &[&str] = &[
    "its", "is", "thats", "getting", "a", "much", "in", "here", "pretty",
];
const THIS_ONE: &[&str] = &["this", "that"];
const LIKES: &[&str] = &["likes", "favorites", "favourites", "liked"];
const POOR: &[&str] = &[
    "sucks", "awful", "terrible", "boring", "garbage", "trash", "annoying",
];

const TRACK: &[&str] = &["music", "song", "track", "tunes", "tune"];
const SOUND: &[&str] = &["sound", "audio", "volume"];
const NOT_THE_TRACK: &[&str] = &[
    "dont", "not", "would", "to", "what", "whats", "you", "me", "us", "him", "her", "them",
];

pub(super) const RULES: &[Rule] = &[
    rule(
        &[TOO, &["loud", "noisy"]],
        ITS,
        &["not", "why"],
        Intent::VolumeDown,
    ),
    rule(
        &[TOO, &["quiet", "low"]],
        ITS,
        &["not", "why"],
        Intent::VolumeUp,
    ),
    rule(
        &[RATHER, &["loud", "noisy"]],
        ITS_SAID,
        &["not", "why"],
        Intent::VolumeDown,
    ),
    rule(
        &[RATHER, &["quiet", "low"]],
        ITS_SAID,
        &["not", "why"],
        Intent::VolumeUp,
    ),
    rule(
        &[&["what", "whats"], &["called"]],
        &["is"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[&["name", "title"], &["of"]],
        &["tell", "me", "give"],
        &[],
        Intent::NowPlaying,
    ),
    rule(&[&["getting"], &["old"]], &["is", "its"], &[], Intent::Next),
    rule(
        &[&["dont"], &["like"]],
        &["i", "really", "at", "all"],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["another"]],
        &["play", "put", "on", "1", "give", "me", "gimme"],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["different"]],
        &["a", "play", "put", "on", "something", "1"],
        &[],
        Intent::Next,
    ),
    rule(&[&["restore"], SOUND], &[], &[], Intent::Unmute),
    rule(&[&["mix"], &["up"]], &["things"], &[], Intent::ShuffleOn),
    rule(
        &[&["play", "put"], &["whatever", "anything"]],
        &["on", "you", "want"],
        &[],
        Intent::PlayWave,
    ),
    rule(
        &[&["random"], &["order"]],
        &["in", "play", "put", "on"],
        &[],
        Intent::ShuffleOn,
    ),
    rule(
        &[&["stop", "quit"], &["shuffling"]],
        &[],
        &[],
        Intent::ShuffleOff,
    ),
    rule(
        &[&["how"], &["use"]],
        &["do", "i", "you", "can", "to", "does", "work"],
        &[],
        Intent::Help,
    ),
    rule(
        &[&["not"], &["again"]],
        &["oh", "god", "please"],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["dial"], &["back", "down"]],
        &["a", "bit", "little", "notch", "tad"],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[&["cant", "cannot"], &["hear"], &["myself"]],
        &["i", "think", "talk", "even"],
        &[],
        Intent::VolumeDown,
    ),
    rule(
        &[&["keep"], &["playing", "going"]],
        &["on"],
        &["dont", "not"],
        Intent::Resume,
    ),
    rule(&[&["carry"], &["on"]], &[], &[], Intent::Resume),
    rule(
        &[
            &["bring", "turn", "put", "get"],
            &["sound", "audio", "volume"],
            &["back"],
        ],
        &["on", "up"],
        &[],
        Intent::Unmute,
    ),
    rule(
        &[&["add", "save", "put"], LIKES],
        &["to", "my", "in", "into", "1", "songs"],
        &[],
        Intent::Like,
    ),
    rule(
        &[&["remove", "take", "delete", "drop"], LIKES],
        &["from", "off", "out", "of", "my", "1", "songs"],
        &[],
        Intent::Unlike,
    ),
    rule(
        &[&["stop", "quit"], &["looping", "repeating"]],
        &[],
        &[],
        Intent::RepeatOff,
    ),
    rule(
        &[&["what", "whats"], &["listening"]],
        &["am", "i", "im", "to", "are", "we", "is"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[&["what", "whats"], &["name", "title"]],
        &["of", "is", "called"],
        &[],
        Intent::NowPlaying,
    ),
    rule(
        &[
            &["put", "change", "set", "go"],
            &["back"],
            &["was", "before"],
        ],
        &["how", "way", "to"],
        &[],
        Intent::Undo,
    ),
    rule(
        &[&["what", "which"], &["commands"]],
        &[
            "do",
            "you",
            "have",
            "are",
            "there",
            "can",
            "i",
            "use",
            "say",
            "understand",
            "know",
        ],
        &[],
        Intent::Help,
    ),
    rule(
        &[&["sick", "tired"], &["of"]],
        &["im", "i", "am", "so", "1", "getting"],
        &["not"],
        Intent::Next,
    ),
    rule(
        &[&["again"], THIS_ONE],
        &["not", "oh", "no", "1", "same"],
        &[],
        Intent::Next,
    ),
    rule(
        &[POOR],
        &["is", "so", "its", "1", "to", "too"],
        &["not"],
        Intent::Next,
    ),
    rule(
        &[&["hate"]],
        &["i", "1", "so", "much"],
        &["dont", "not"],
        Intent::Next,
    ),
    rule(
        &[&["thumbs"], &["up"]],
        &["a", "big", "give", "2"],
        &[],
        Intent::Like,
    ),
    rule(
        &[&["love"]],
        &["i", "so", "much", "absolutely", "1"],
        NOT_THE_TRACK,
        Intent::Like,
    )
    .len(2),
    rule(
        &[&["play", "playing", "go"], &["order"]],
        &["in", "them", "back", "to"],
        &[],
        Intent::ShuffleOff,
    ),
    rule(&[&["surprise"]], &["me", "us"], &[], Intent::PlayWave),
    rule(
        &[&["recommend", "suggest"]],
        &[
            "me",
            "us",
            "something",
            "anything",
            "some",
            "new",
            "good",
            "can",
            "you",
        ],
        &[],
        Intent::PlayWave,
    ),
    rule(&[&["take"], &["back"]], &[], &[], Intent::Undo),
    rule(
        &[&["ears"], &["bleeding", "hurt", "hurting", "ringing"]],
        &["my", "are"],
        &[],
        Intent::VolumeDown,
    ),
    rule(&[&["kill", "cut"], TRACK], &[], &[], Intent::Stop),
    rule(&[&["kill", "cut"], SOUND], &[], &[], Intent::Mute),
    rule(&[&["run"], &["back"]], &["1"], &[], Intent::SeekTo),
    rule(
        &[&["silence"]],
        &["i", "need", "want", "some", "please", "bit", "of", "little"],
        &[],
        Intent::Pause,
    ),
    rule(
        &[&["dont"], &["wanna", "want"], &["hear", "listen"]],
        &["i", "to", "1", "anymore"],
        &[],
        Intent::Next,
    ),
];
