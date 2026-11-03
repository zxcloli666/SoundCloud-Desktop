use std::f32::consts::TAU;
use std::num::NonZero;
use std::sync::Arc;
use std::time::{Duration, Instant};

use rodio::Source;
use rodio::buffer::SamplesBuffer;

use super::*;

const RATE: u32 = 48_000;

type Frames = Vec<(f32, f32)>;

fn buffer(frames: &[(f32, f32)]) -> SamplesBuffer {
    let samples = frames.iter().flat_map(|&(l, r)| [l, r]).collect::<Vec<_>>();
    SamplesBuffer::new(
        NonZero::new(2).unwrap(),
        NonZero::new(RATE).unwrap(),
        samples,
    )
}

fn secs(s: f32) -> usize {
    (RATE as f32 * s) as usize
}

fn sine(hz: f32, amplitude: f32, seconds: f32) -> Frames {
    (0..secs(seconds))
        .map(|i| {
            let v = (i as f32 / RATE as f32 * hz * TAU).sin() * amplitude;
            (v, v)
        })
        .collect()
}

fn noise(amplitude: f32, seconds: f32) -> Frames {
    let mut seed = 0x1234_5678u32;
    let mut next = move || {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        (seed as f32 / u32::MAX as f32 * 2.0 - 1.0) * amplitude
    };
    (0..secs(seconds)).map(|_| (next(), next())).collect()
}

fn settings(change: impl FnOnce(&mut Settings)) -> Settings {
    let mut settings = Settings::default();
    change(&mut settings);
    settings
}

fn params(settings: Settings, premium: bool) -> Arc<EffectsParams> {
    let params = Arc::new(EffectsParams::new());
    params.set(settings);
    params.set_premium(premium);
    params
}

fn pairs(samples: Vec<f32>) -> Frames {
    samples.chunks(2).map(|pair| (pair[0], pair[1])).collect()
}

fn render(input: &[(f32, f32)], params: Arc<EffectsParams>) -> Frames {
    pairs(EffectsSource::new(buffer(input), params).collect())
}

fn energy(frames: &[(f32, f32)]) -> (f64, f64) {
    frames.iter().fold((0.0, 0.0), |(l, r), &(a, b)| {
        (l + (a as f64).powi(2), r + (b as f64).powi(2))
    })
}

fn rms_db(frames: &[(f32, f32)]) -> f64 {
    10.0 * (energy(frames).0 / frames.len() as f64).log10()
}

fn peak(frames: &[(f32, f32)]) -> f32 {
    frames
        .iter()
        .fold(0.0, |top, &(l, r)| top.max(l.abs()).max(r.abs()))
}

fn same_bits(a: &[(f32, f32)], b: &[(f32, f32)]) -> bool {
    a.iter()
        .zip(b)
        .all(|(x, y)| x.0.to_bits() == y.0.to_bits() && x.1.to_bits() == y.1.to_bits())
}

fn largest_step(frames: &[(f32, f32)]) -> f32 {
    frames
        .windows(2)
        .map(|pair| (pair[1].0 - pair[0].0).abs())
        .fold(0.0, f32::max)
}

fn impulse(seconds: f32) -> Frames {
    let mut frames = vec![(0.0, 0.0); secs(seconds)];
    frames[0] = (0.8, 0.8);
    frames
}

#[test]
fn reverb_rings_after_an_impulse() {
    let input = impulse(3.0);
    let room = |size: f32| settings(|s| (s.reverb, s.room) = (0.6, size));
    let dry = render(&input, params(Settings::default(), true));
    let wet = render(&input, params(room(0.5), true));
    let small = render(&input, params(room(0.0), true));
    let large = render(&input, params(room(1.0), true));

    let tail = |frames: &[(f32, f32)]| energy(&frames[secs(0.3)..secs(1.5)]).0;
    let late = |frames: &[(f32, f32)]| energy(&frames[secs(1.5)..secs(3.0)]).0;
    eprintln!(
        "reverb tail energy 0.3-1.5s: dry {:e} wet {:e}; 1.5-3s small room {:e} large room {:e}",
        tail(&dry),
        tail(&wet),
        late(&small),
        late(&large)
    );
    assert_eq!(tail(&dry), 0.0);
    assert!(tail(&wet) > 1e-4);
    assert!(late(&large) > late(&small) * 5.0);
}

#[test]
fn reverb_level_stays_near_the_dry_level() {
    let input = noise(0.3, 4.0);
    let wet = render(&input, params(settings(|s| s.reverb = 1.0), true));
    let shift = rms_db(&wet[secs(1.0)..]) - rms_db(&input[secs(1.0)..]);
    eprintln!("full reverb level against dry: {shift:.1} dB");
    assert!(shift.abs() < 6.0, "{shift}");
}

#[test]
fn eight_d_swaps_sides_over_one_period() {
    let hz = 0.2;
    let period = secs(1.0 / hz);
    let input = sine(440.0, 0.5, 1.0 / hz);
    let output = render(
        &input,
        params(settings(|s| (s.eight_d, s.eight_d_hz) = (true, hz)), true),
    );
    assert_eq!(output.len(), period);

    let first = energy(&output[..period / 2]);
    let second = energy(&output[period / 2..]);
    eprintln!(
        "8D energy L/R: first half {:.2}/{:.2}, second half {:.2}/{:.2}",
        first.0, first.1, second.0, second.1
    );
    assert!(first.1 > first.0 * 1.5);
    assert!(second.0 > second.1 * 1.5);
}

fn bass_gain_db(hz: f32, bass_db: f32) -> f64 {
    let input = sine(hz, 0.251, 2.0);
    let output = render(&input, params(settings(|s| s.bass_db = bass_db), true));
    rms_db(&output[secs(1.0)..]) - rms_db(&input[secs(1.0)..])
}

#[test]
fn bass_boost_lifts_lows_over_mids() {
    let low = bass_gain_db(60.0, 9.0);
    let mid = bass_gain_db(1000.0, 9.0);
    eprintln!(
        "bass +9 dB: 60 Hz {low:.2} dB, 1 kHz {mid:.2} dB, spread {:.2} dB",
        low - mid
    );
    assert!(low >= 7.0, "{low}");
    assert!(mid.abs() <= 0.5, "{mid}");
}

#[test]
fn full_scale_input_never_passes_zero_dbfs() {
    let everything = settings(|s| {
        s.reverb = 1.0;
        s.room = 1.0;
        s.eight_d = true;
        s.bass_db = 12.0;
    });
    let inputs = [
        sine(60.0, 1.0, 3.0),
        sine(1000.0, 1.0, 1.0),
        noise(1.0, 2.0),
    ];
    for input in inputs {
        let output = render(&input, params(everything, true));
        let top = peak(&output);
        eprintln!("full scale peak with everything on: {top:.4}");
        assert!(top <= 1.0);
        assert!(output.iter().all(|f| f.0.is_finite() && f.1.is_finite()));
    }
    let bass = settings(|s| s.bass_db = 12.0);
    let output = render(&sine(60.0, 1.0, 3.0), params(bass, true));
    eprintln!(
        "full scale 60 Hz with bass +12 dB peak: {:.4}",
        peak(&output)
    );
    assert!(peak(&output) <= 1.0);
}

#[test]
fn bypass_is_bit_exact_without_premium() {
    let everything = settings(|s| {
        s.reverb = 1.0;
        s.eight_d = true;
        s.bass_db = 12.0;
    });
    let input = noise(0.9, 1.0);
    let output = render(&input, params(everything, false));
    assert!(same_bits(&input, &output));
}

#[test]
fn losing_and_regaining_star_keeps_the_settings() {
    let everything = settings(|s| {
        s.reverb = 0.5;
        s.eight_d = true;
        s.bass_db = 6.0;
    });
    let params = params(everything, true);
    let input = noise(0.5, 3.0);
    let mut source = EffectsSource::new(buffer(&input), params.clone());
    let mut output = source.by_ref().take(secs(1.0) * 2).collect::<Vec<_>>();
    params.set_premium(false);
    output.extend(source.by_ref().take(secs(1.0) * 2));
    params.set_premium(true);
    output.extend(source);
    let frames = pairs(output);

    let settled = secs(1.0) + secs(0.8)..secs(2.0);
    assert!(same_bits(&frames[settled.clone()], &input[settled]));
    let back = secs(2.5)..frames.len();
    let differs = frames[back.clone()]
        .iter()
        .zip(&input[back])
        .any(|(a, b)| (a.0 - b.0).abs() > 1e-3);
    assert!(differs);
}

#[test]
fn toggling_does_not_click() {
    let params = params(Settings::default(), true);
    let input = sine(200.0, 0.5, 2.0);
    let mut source = EffectsSource::new(buffer(&input), params.clone());
    let mut output = source.by_ref().take(secs(0.5) * 2).collect::<Vec<_>>();
    params.set(settings(|s| s.bass_db = 12.0));
    output.extend(source.by_ref().take(secs(0.7) * 2));
    params.set(Settings::default());
    output.extend(source);

    let step = largest_step(&pairs(output));
    eprintln!("largest sample step while toggling bass: {step:.4}");
    assert!(step < 0.1, "{step}");
}

#[test]
fn seek_clears_the_tail() {
    let params = params(settings(|s| s.reverb = 1.0), true);
    let mut source = EffectsSource::new(buffer(&impulse(2.0)), params);
    let _ = source.by_ref().take(secs(0.5) * 2).count();
    source.try_seek(Duration::from_millis(1500)).unwrap();
    assert!(source.take(2000).all(|sample| sample == 0.0));
}

fn time_render(input: &[(f32, f32)], params: Arc<EffectsParams>) -> Duration {
    let source = EffectsSource::new(buffer(input), params);
    let start = Instant::now();
    let sum: f32 = source.sum();
    std::hint::black_box(sum);
    start.elapsed()
}

#[test]
fn cpu_cost_per_block() {
    let input = noise(0.5, 10.0);
    let all = settings(|s| {
        s.reverb = 0.6;
        s.eight_d = true;
        s.bass_db = 6.0;
    });
    let busy = time_render(&input, params(all, true));
    let quiet = time_render(&input, params(Settings::default(), true));
    let per_us = |took: Duration| input.len() as f64 / took.as_micros() as f64;
    let per_ns = |took: Duration| took.as_nanos() as f64 / input.len() as f64;
    eprintln!(
        "cpu ({}): all effects {:.2} frames/us ({:.0} ns/frame), bypassed {:.2} frames/us ({:.0} ns/frame)",
        if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        },
        per_us(busy),
        per_ns(busy),
        per_us(quiet),
        per_ns(quiet)
    );
    assert!(per_us(busy) > 0.0);
}
