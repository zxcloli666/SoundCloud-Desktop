use voice_speech::to_16k;

#[test]
fn keeps_duration() {
    let input = vec![0.1f32; 48_000];
    let out = to_16k(&input, 48_000).unwrap();
    assert!((out.len() as i64 - 16_000).abs() < 8);
}

#[test]
fn passes_16k_through() {
    let input = vec![0.2f32; 1600];
    assert_eq!(to_16k(&input, 16_000).unwrap(), input);
}
