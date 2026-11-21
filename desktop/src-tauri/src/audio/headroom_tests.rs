use std::f32::consts::TAU;
use std::num::NonZero;
use std::sync::atomic::AtomicU32;
use std::sync::{Arc, RwLock};

use rodio::buffer::SamplesBuffer;

use crate::audio::effects::{EffectsParams, EffectsSource};
use crate::audio::eq::{EqSource, GainSource};
use crate::audio::master::{Master, Render};
use crate::audio::pitch::PitchSource;
use crate::audio::types::{EQ_BANDS, EqParams};

const RATE: u32 = 48_000;
const REPORTED_PRESET: [f64; EQ_BANDS] = [5.0, 7.0, 4.5, -2.5, -3.0, -4.5, -3.0, 2.5, 3.0, 5.0];

pub fn music(seconds: f32) -> Vec<f32> {
    let frames = (RATE as f32 * seconds) as usize;
    let mut seed = 0x1234_5678u32;
    let mut last = 0.0f32;
    let mut kick_phase = 0.0f32;
    let notes = [41.2f32, 55.0, 49.0, 36.7];
    let mono: Vec<f32> = (0..frames)
        .map(|i| {
            let t = i as f32 / RATE as f32;
            let beat = t % 0.5;
            kick_phase += (50.0 + 100.0 * (-beat / 0.03).exp()) / RATE as f32;
            let kick = (kick_phase * TAU).sin() * (-beat / 0.25).exp() * 0.9;
            let note = notes[t as usize % notes.len()];
            let bass = (1..=6)
                .map(|k| (t * note * k as f32 * TAU).sin() / k as f32)
                .sum::<f32>()
                * 0.35;
            let chord = [220.0f32, 277.2, 329.6]
                .iter()
                .flat_map(|f| (1..=4).map(move |k| (t * f * k as f32 * TAU).sin() / (k * k) as f32))
                .sum::<f32>()
                * 0.06;
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let white = (seed >> 8) as f32 / (1u32 << 24) as f32 * 2.0 - 1.0;
            let hats = (white - last) * (-((t + 0.25) % 0.5) / 0.04).exp() * 0.25;
            last = white;
            let snare = (white * 0.6 + (t * 180.0 * TAU).sin() * 0.4)
                * (-((t + 0.5) % 1.0) / 0.08).exp()
                * 0.45;
            kick + bass + chord + hats + snare
        })
        .collect();
    let rms = (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
    let mastered: Vec<f32> = mono.iter().map(|s| (s / rms * 0.55).tanh()).collect();
    let scale = 10f32.powf(-1.0 / 20.0) / peak(&mastered);
    mastered.iter().flat_map(|s| [s * scale; 2]).collect()
}

pub fn peak(samples: &[f32]) -> f32 {
    samples
        .iter()
        .fold(0.0, |peak, sample| peak.max(sample.abs()))
}

pub fn pinned(samples: &[f32]) -> f64 {
    samples
        .iter()
        .filter(|sample| sample.abs() >= 0.9999)
        .count() as f64
        / samples.len() as f64
}

fn buffer(samples: Vec<f32>) -> SamplesBuffer {
    SamplesBuffer::new(
        NonZero::new(2).unwrap(),
        NonZero::new(RATE).unwrap(),
        samples,
    )
}

pub fn chain(samples: Vec<f32>, gains: [f64; EQ_BANDS], preamp: f64, volume: f32) -> Vec<f32> {
    let params = Arc::new(RwLock::new(EqParams {
        enabled: true,
        gains,
        preamp,
    }));
    let ratio = Arc::new(AtomicU32::new(1.0f32.to_bits()));
    EffectsSource::new(
        EqSource::new(
            PitchSource::new(GainSource::new(buffer(samples), 1.0), ratio),
            params,
        ),
        Arc::new(EffectsParams::new()),
    )
    .map(|sample| sample * volume)
    .collect()
}

pub fn output(samples: Vec<f32>) -> Vec<f32> {
    let channels = NonZero::new(2).unwrap();
    let rate = NonZero::new(RATE).unwrap();
    let (music, music_out) = rodio::mixer::mixer(channels, rate);
    let (_voice, voice_out) = rodio::mixer::mixer(channels, rate);
    let mut render = Render::new(Master::new(), music_out, voice_out);
    let mut out = vec![0.0; samples.len()];
    music.add(buffer(samples));
    render.fill(&mut out);
    out
}

#[test]
fn reported_preset_keeps_headroom_inside_the_chain() {
    let input = music(4.0);
    assert!((peak(&input) - 0.891).abs() < 0.01);
    let shaped = chain(input, REPORTED_PRESET, -1.0, 1.0);
    assert!(peak(&shaped) > 1.5, "{}", peak(&shaped));
    assert_eq!(
        shaped.iter().filter(|sample| sample.abs() == 1.0).count(),
        0
    );
}

#[test]
fn reported_preset_never_clips_at_the_output() {
    let shaped = chain(music(4.0), REPORTED_PRESET, -1.0, 1.0);
    let out = output(shaped);
    assert!(peak(&out) <= 1.0 + 1e-6, "{}", peak(&out));
    assert!(pinned(&out) < 0.002, "{}", pinned(&out));
}

#[test]
fn lower_volume_takes_the_preset_back_under_full_scale() {
    let shaped = chain(music(4.0), REPORTED_PRESET, -1.0, 0.5);
    let out = output(shaped.clone());
    assert!(peak(&shaped) < 1.0, "{}", peak(&shaped));
    let bits = |values: &[f32]| values.iter().map(|v| v.to_bits()).collect::<Vec<_>>();
    assert_eq!(bits(&out), bits(&shaped));
}
