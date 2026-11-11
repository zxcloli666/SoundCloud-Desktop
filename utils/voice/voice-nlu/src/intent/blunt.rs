use super::indirect::{Rule, THIS, rule};
use crate::types::Intent;

pub(super) const RULES: &[Rule] = &[
    rule(
        &[&["завязывай", "заканчивай", "кончай"]],
        &["с", "этой", "музыкой", "музыку", "эту", "песней", "уже"],
        &["не"],
        Intent::Stop,
    ),
    rule(
        &[&["hear"], &["cant", "cannot", "barely", "hardly"]],
        &["anything", "it", "the", "music", "this", "a", "thing"],
        &[],
        Intent::VolumeUp,
    ),
    rule(
        &[&["shut"], &["up"]],
        &["the", "hell", "fuck", "already"],
        &[],
        Intent::Stop,
    ),
    rule(
        &[&["заебала", "заебало", "заебал"], THIS],
        &[],
        &[],
        Intent::Next,
    ),
    rule(
        &[&["орать", "орет", "орешь", "ори"], &["тише", "потише"]],
        &["хватит", "сделай", "чего", "давай"],
        &[],
        Intent::VolumeDown,
    ),
];
