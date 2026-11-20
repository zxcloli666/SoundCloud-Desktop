use std::ops::Range;

use crate::SAMPLE_RATE;

const WINDOW: usize = SAMPLE_RATE as usize / 50;
const SMOOTHED_OVER: usize = 5;
const BEFORE: usize = SAMPLE_RATE as usize / 5;
const AFTER: usize = SAMPLE_RATE as usize * 3 / 10;
const FADE: usize = SAMPLE_RATE as usize / 5;
const ROOM_SHARE: f32 = 0.1;
const APART: f32 = 2.0;
const OVER_ROOM: f32 = 1.5;

pub fn spoken(samples: &[f32]) -> Vec<f32> {
    let Some(voice) = voice(samples) else {
        return samples.to_vec();
    };
    let start = voice.start.saturating_sub(BEFORE);
    let end = (voice.end + AFTER).min(samples.len());
    let mut part = samples[start..end].to_vec();
    let rise = (voice.start - start).min(FADE);
    for (at, sample) in part[..rise].iter_mut().enumerate() {
        *sample *= at as f32 / rise as f32;
    }
    let fall = (end - voice.end).min(FADE);
    for (at, sample) in part.iter_mut().rev().take(fall).enumerate() {
        *sample *= at as f32 / fall as f32;
    }
    part
}

fn voice(samples: &[f32]) -> Option<Range<usize>> {
    let levels: Vec<f32> = samples.chunks_exact(WINDOW).map(level).collect();
    let levels = smoothed(&levels);
    let top = levels.iter().copied().fold(0.0, f32::max);
    let room = share(&levels, ROOM_SHARE);
    if top < room * APART {
        return None;
    }
    let line = (top * room).sqrt();
    let loud = |level: &f32| *level >= line;
    let mut first = levels.iter().position(loud)?;
    let mut last = levels.iter().rposition(loud)?;
    let mut around = levels[..first].to_vec();
    around.extend_from_slice(&levels[last + 1..]);
    if around.len() >= SMOOTHED_OVER {
        let soft = (share(&around, 0.5) * OVER_ROOM).min(line);
        while first > 0 && levels[first - 1] >= soft {
            first -= 1;
        }
        while last + 1 < levels.len() && levels[last + 1] >= soft {
            last += 1;
        }
    }
    Some(first * WINDOW..(last + 1) * WINDOW)
}

fn level(window: &[f32]) -> f32 {
    (window.iter().map(|s| s * s).sum::<f32>() / window.len() as f32).sqrt()
}

fn smoothed(levels: &[f32]) -> Vec<f32> {
    let reach = SMOOTHED_OVER / 2;
    (0..levels.len())
        .map(|at| {
            let from = at.saturating_sub(reach);
            let to = (at + reach + 1).min(levels.len());
            share(&levels[from..to], 0.5)
        })
        .collect()
}

fn share(levels: &[f32], share: f32) -> f32 {
    if levels.is_empty() {
        return 0.0;
    }
    let mut sorted = levels.to_vec();
    sorted.sort_by(f32::total_cmp);
    sorted[((sorted.len() as f32 * share) as usize).min(sorted.len() - 1)]
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: usize = SAMPLE_RATE as usize;

    fn hum(seconds: f32, loudness: f32) -> Vec<f32> {
        (0..(seconds * RATE as f32) as usize)
            .map(|at| {
                let wobble = 1.0 + 0.3 * (at as f32 * 0.013).sin();
                loudness * wobble * (at as f32 * 0.9).sin()
            })
            .collect()
    }

    fn said_in_a_room(before: f32, said: f32, after: f32, room: f32) -> Vec<f32> {
        let mut clip = hum(before, room);
        clip.extend(hum(said, 0.5));
        clip.extend(hum(after, room));
        clip
    }

    fn near(at: usize, seconds: f32) -> bool {
        at.abs_diff((seconds * RATE as f32) as usize) <= RATE / 20
    }

    #[test]
    fn a_noisy_room_before_and_after_the_words_is_cut_off() {
        let clip = said_in_a_room(1.0, 0.6, 1.0, 0.15);
        let voice = voice(&clip).unwrap();
        assert!(near(voice.start, 1.0) && near(voice.end, 1.6), "{voice:?}");
        let part = spoken(&clip);
        assert!(near(part.len(), 0.6 + 0.2 + 0.3), "{}", part.len());
    }

    #[test]
    fn the_cut_edges_fade_and_the_words_do_not() {
        let clip = said_in_a_room(1.0, 0.6, 1.0, 0.15);
        let part = spoken(&clip);
        let loudest = |samples: &[f32]| samples.iter().fold(0.0f32, |top, s| top.max(s.abs()));
        assert!(loudest(&part[..RATE / 50]) < 0.03);
        assert!(loudest(&part[part.len() - RATE / 50..]) < 0.03);
        assert!(loudest(&part[RATE / 4..RATE / 2]) > 0.4);
    }

    #[test]
    fn a_room_as_loud_as_the_voice_is_kept_whole() {
        let clip = said_in_a_room(1.0, 0.6, 1.0, 0.4);
        assert_eq!(spoken(&clip), clip);
    }

    #[test]
    fn silence_around_the_words_is_kept_whole() {
        let clip = said_in_a_room(0.5, 0.6, 0.5, 0.0);
        assert_eq!(spoken(&clip), clip);
    }

    #[test]
    fn words_from_the_very_start_are_not_faded() {
        let clip = said_in_a_room(0.0, 0.6, 1.0, 0.05);
        let part = spoken(&clip);
        assert_eq!(part[..RATE / 10], clip[..RATE / 10]);
    }

    #[test]
    fn a_click_of_the_key_is_not_taken_for_the_voice() {
        let mut clip = said_in_a_room(1.0, 0.6, 1.0, 0.05);
        for sample in &mut clip[..WINDOW] {
            *sample = 0.9;
        }
        let voice = voice(&clip).unwrap();
        assert!(near(voice.start, 1.0), "{voice:?}");
    }

    #[test]
    fn a_pause_between_words_stays_inside() {
        let mut clip = said_in_a_room(1.0, 0.5, 0.6, 0.05);
        clip.extend(hum(0.5, 0.5));
        clip.extend(hum(1.0, 0.05));
        let voice = voice(&clip).unwrap();
        assert!(near(voice.start, 1.0) && near(voice.end, 2.6), "{voice:?}");
    }

    #[test]
    fn a_soft_end_of_a_word_over_a_steady_room_is_kept() {
        let mut clip = said_in_a_room(1.0, 0.6, 0.0, 0.03);
        clip.extend(hum(0.2, 0.08));
        clip.extend(hum(1.0, 0.03));
        let voice = voice(&clip).unwrap();
        assert!(near(voice.end, 1.8), "{voice:?}");
    }
}
