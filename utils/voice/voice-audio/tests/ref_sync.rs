use voice_audio::ref_sync::RefSync;

#[test]
fn steering_follows_a_slow_producer_without_glitches() {
    let rate = 48_000usize;
    let ratio = 1.0 + 500e-6;
    let chunk = 512;
    let frames = 6000;
    let mut sync = RefSync::new(rate as u32, 16, true);
    let mut out = vec![0.0f32; rate / 100];
    let source = vec![0.25f32; rate * 70];
    let mut delivered = 0;
    for i in 0..frames {
        let available = (((i + 1) * rate / 100) as f64 / ratio) as usize / chunk * chunk;
        if available > delivered {
            sync.push(&source[delivered..available]);
            delivered = available;
        }
        sync.pull(&mut out);
    }
    assert_eq!(sync.underruns, 0);
    assert_eq!(sync.overruns, 0);
    assert!(
        sync.fill() > 256 && sync.fill() < 2048,
        "fill {}",
        sync.fill()
    );
    assert!(
        (sync.ratio_ppm() + 500.0).abs() < 150.0,
        "ppm {}",
        sync.ratio_ppm()
    );
}
