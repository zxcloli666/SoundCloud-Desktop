use voice_audio::frames::{FRAME, Frame};
use voice_audio::select::Selector;

fn noise(seed: &mut u32, amp: f32) -> Frame {
    let mut frame = [0.0; FRAME];
    for s in &mut frame {
        *seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        *s = ((*seed >> 8) as f32 / (1 << 24) as f32 - 0.5) * 2.0 * amp;
    }
    frame
}

fn speech(seed: &mut u32, amp: f32, noise_amp: f32) -> Frame {
    let mut frame = noise(seed, noise_amp);
    for (i, s) in frame.iter_mut().enumerate() {
        *s += amp * (i as f32 * 0.2).sin();
    }
    frame
}

fn run(
    selector: &mut Selector,
    seed: &mut u32,
    frames: usize,
    levels: &[(f32, f32)],
) -> Vec<usize> {
    let mut emitted = Vec::new();
    for _ in 0..frames {
        for (input, (speech_amp, noise_amp)) in levels.iter().enumerate() {
            let frame = if *speech_amp > 0.0 {
                speech(seed, *speech_amp, *noise_amp)
            } else {
                noise(seed, *noise_amp)
            };
            for (i, _) in selector.push(input, frame) {
                emitted.push(i);
            }
        }
    }
    emitted
}

#[test]
fn picks_input_with_best_speech_to_noise() {
    let mut selector = Selector::new(2);
    let mut seed = 7;
    run(&mut selector, &mut seed, 100, &[(0.0, 0.05), (0.0, 0.003)]);
    assert_eq!(selector.locked(), None);
    let emitted = run(&mut selector, &mut seed, 60, &[(0.2, 0.05), (0.2, 0.003)]);
    assert_eq!(selector.locked(), Some(1));
    let tail = &emitted[emitted.len() - 20..];
    assert!(tail.iter().all(|&i| i == 1));
}

#[test]
fn picks_the_first_input_when_it_is_cleaner() {
    let mut selector = Selector::new(3);
    let mut seed = 99;
    let quiet = [(0.0, 0.002), (0.0, 0.02), (0.0, 0.02)];
    run(&mut selector, &mut seed, 100, &quiet);
    run(
        &mut selector,
        &mut seed,
        40,
        &[(0.15, 0.002), (0.05, 0.02), (0.05, 0.02)],
    );
    assert_eq!(selector.locked(), Some(0));
}

#[test]
fn releases_after_silence_and_can_switch() {
    let mut selector = Selector::new(2);
    let mut seed = 3;
    run(&mut selector, &mut seed, 100, &[(0.0, 0.01), (0.0, 0.01)]);
    run(&mut selector, &mut seed, 40, &[(0.2, 0.01), (0.05, 0.01)]);
    assert_eq!(selector.locked(), Some(0));
    run(&mut selector, &mut seed, 100, &[(0.0, 0.01), (0.0, 0.01)]);
    assert_eq!(selector.locked(), None);
    run(&mut selector, &mut seed, 40, &[(0.05, 0.01), (0.2, 0.01)]);
    assert_eq!(selector.locked(), Some(1));
}

#[test]
fn short_click_is_not_speech() {
    let mut selector = Selector::new(2);
    let mut seed = 5;
    run(&mut selector, &mut seed, 100, &[(0.0, 0.01), (0.0, 0.01)]);
    run(&mut selector, &mut seed, 1, &[(0.3, 0.01), (0.0, 0.01)]);
    run(&mut selector, &mut seed, 30, &[(0.0, 0.01), (0.0, 0.01)]);
    assert_eq!(selector.locked(), None);
}

#[test]
fn every_frame_comes_out_once_in_idle() {
    let mut selector = Selector::new(2);
    let mut seed = 11;
    let emitted = run(&mut selector, &mut seed, 100, &[(0.0, 0.01), (0.0, 0.01)]);
    assert_eq!(emitted.len(), 100);
    assert!(emitted.iter().all(|&i| i == 0));
}
