use voice_audio::frames::{FRAME, Framer, RATE, rms};

fn sine(rate: u32, seconds: f32, freq: f32, amp: f32) -> Vec<f32> {
    (0..(rate as f32 * seconds) as usize)
        .map(|i| amp * (2.0 * std::f32::consts::PI * freq * i as f32 / rate as f32).sin())
        .collect()
}

#[test]
fn ten_ms_frames_at_16k_from_common_rates() {
    for rate in [16_000, 44_100, 48_000, 32_000, 24_000, 22_050, 96_000] {
        let mut framer = Framer::new(rate).unwrap();
        let input = sine(rate, 2.0, 440.0, 0.5);
        let mut frames = 0;
        for chunk in input.chunks(rate as usize / 100 + 7) {
            frames += framer.push(chunk).len();
        }
        assert!(
            (190..=200).contains(&frames),
            "rate {rate}: {frames} frames for 2 s"
        );
    }
    assert_eq!(FRAME, RATE as usize / 100);
}

#[test]
fn resampling_keeps_tone_level() {
    let mut framer = Framer::new(48_000).unwrap();
    let input = sine(48_000, 1.0, 440.0, 0.5);
    let mut levels = Vec::new();
    for chunk in input.chunks(480) {
        for frame in framer.push(chunk) {
            levels.push(rms(&frame));
        }
    }
    let tail = &levels[20..];
    let mean = tail.iter().sum::<f32>() / tail.len() as f32;
    assert!((mean - 0.5 / 2f32.sqrt()).abs() < 0.02, "mean {mean}");
}

#[test]
fn passthrough_at_16k_is_exact() {
    let mut framer = Framer::new(16_000).unwrap();
    let input: Vec<f32> = (0..480).map(|i| i as f32).collect();
    let frames = framer.push(&input[..100]);
    assert!(frames.is_empty());
    let frames = framer.push(&input[100..]);
    assert_eq!(frames.len(), 3);
    assert_eq!(frames[0][5], 5.0);
    assert_eq!(frames[2][159], 479.0);
}
