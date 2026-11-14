use voice_audio::aec::{AecConfig, SonoraAec};
use voice_audio::echo_gate::{EchoGate, REFERENCE_HOLD_FRAMES};
use voice_audio::frames::{FRAME, Frame};

const RATE: usize = 16_000;

fn aec() -> SonoraAec {
    SonoraAec::new(AecConfig {
        sample_rate: RATE as u32,
        noise_suppression: false,
        delay_ms: None,
    })
    .unwrap()
}

fn noise(total: usize, amp: f32) -> Vec<f32> {
    let mut state = 12345u32;
    (0..total)
        .map(|_| {
            state = state.wrapping_mul(1664525).wrapping_add(1013904223);
            ((state >> 8) as f32 / 8388608.0 - 1.0) * amp
        })
        .collect()
}

fn voice(total: usize) -> Vec<f32> {
    (0..total)
        .map(|i| 0.2 * (i as f32 * 2.0 * std::f32::consts::PI * 300.0 / RATE as f32).sin())
        .collect()
}

fn frame(samples: &[f32], i: usize) -> Frame {
    samples[i * FRAME..(i + 1) * FRAME].try_into().unwrap()
}

fn run(mic: &[f32], reference: Option<&[f32]>) -> (Vec<f32>, Vec<f32>) {
    let mut aec = aec();
    let mut gate = EchoGate::new();
    let silence = [0.0; FRAME];
    let mut gated = Vec::new();
    let mut plain = Vec::new();
    for i in 0..mic.len() / FRAME {
        let reference = reference.map_or(silence, |r| frame(r, i));
        let raw = frame(mic, i);
        let mut cleaned = [0.0; FRAME];
        aec.render(&reference).unwrap();
        aec.capture(&raw, &mut cleaned).unwrap();
        gated.extend(gate.mix(&reference, &raw, &cleaned));
        plain.extend(cleaned);
    }
    (gated, plain)
}

#[test]
fn no_reference_is_bit_exact() {
    let mic = voice(RATE * 4);
    let (gated, plain) = run(&mic, None);
    assert_eq!(gated, mic);
    assert_ne!(plain, mic);
}

#[test]
fn zero_reference_is_bit_exact() {
    let mic: Vec<f32> = voice(RATE * 4)
        .iter()
        .zip(noise(RATE * 4, 0.05))
        .map(|(a, b)| a + b)
        .collect();
    let zeros = vec![0.0; mic.len()];
    let (gated, _) = run(&mic, Some(&zeros));
    assert_eq!(gated, mic);
}

#[test]
fn real_reference_keeps_cancellation() {
    let total = RATE * 12;
    let delay = 320;
    let reference = noise(total, 0.3);
    let mic: Vec<f32> = (0..total)
        .map(|i| {
            if i >= delay {
                reference[i - delay] * 0.5
            } else {
                0.0
            }
        })
        .collect();
    let (gated, plain) = run(&mic, Some(&reference));
    let tail = total - RATE * 2..total;
    let before: f32 = mic[tail.clone()].iter().map(|v| v * v).sum();
    let after: f32 = gated[tail.clone()].iter().map(|v| v * v).sum();
    let ungated: f32 = plain[tail.clone()].iter().map(|v| v * v).sum();
    assert!(after < before / 30.0, "before {before} after {after}");
    assert_eq!(gated[tail.clone()], plain[tail]);
    assert!(after <= ungated);
}

#[test]
fn switching_has_no_jump() {
    let total = RATE * 6;
    let mic = voice(total);
    let mut reference = vec![0.0; total];
    let loud = noise(RATE * 2, 0.3);
    reference[RATE * 2..RATE * 4].copy_from_slice(&loud);
    let (gated, _) = run(&mic, Some(&reference));
    let worst = gated
        .windows(2)
        .map(|w| (w[1] - w[0]).abs())
        .fold(0.0, f32::max);
    assert!(worst < 0.06, "worst step {worst}");
    assert_eq!(gated[..RATE * 2 - FRAME], mic[..RATE * 2 - FRAME]);
    let back = RATE * 4 + (REFERENCE_HOLD_FRAMES as usize + 3) * FRAME;
    assert_eq!(gated[back..], mic[back..]);
}
