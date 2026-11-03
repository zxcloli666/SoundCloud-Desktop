use voice_audio::aec::{AecConfig, SonoraAec};

fn config(sample_rate: u32) -> AecConfig {
    AecConfig {
        sample_rate,
        noise_suppression: false,
        delay_ms: None,
    }
}

#[test]
fn rejects_unsupported_rate() {
    assert!(SonoraAec::new(config(44_100)).is_err());
}

#[test]
fn accepts_both_rates() {
    for rate in [16_000, 48_000] {
        let mut aec = SonoraAec::new(config(rate)).unwrap();
        let frame = vec![0.0; config(rate).frame_len()];
        let mut out = vec![0.0; frame.len()];
        aec.render(&frame).unwrap();
        aec.capture(&frame, &mut out).unwrap();
    }
}

#[test]
fn cancels_delayed_noise_echo() {
    let rate = 16_000;
    let frame_len = config(rate).frame_len();
    let delay = 320;
    let seconds = 12;
    let total = rate as usize * seconds;
    let mut state = 12345u32;
    let reference: Vec<f32> = (0..total)
        .map(|_| {
            state = state.wrapping_mul(1664525).wrapping_add(1013904223);
            ((state >> 8) as f32 / 8388608.0 - 1.0) * 0.3
        })
        .collect();
    let mic: Vec<f32> = (0..total)
        .map(|i| if i >= delay { reference[i - delay] * 0.5 } else { 0.0 })
        .collect();

    let mut aec = SonoraAec::new(config(rate)).unwrap();
    let mut out = vec![0.0; total];
    for i in 0..total / frame_len {
        let range = i * frame_len..(i + 1) * frame_len;
        aec.render(&reference[range.clone()]).unwrap();
        aec.capture(&mic[range.clone()], &mut out[range]).unwrap();
    }

    let tail = total - rate as usize * 2..total;
    let before: f32 = mic[tail.clone()].iter().map(|v| v * v).sum();
    let after: f32 = out[tail].iter().map(|v| v * v).sum();
    assert!(after < before / 30.0, "before {before} after {after}");
}
