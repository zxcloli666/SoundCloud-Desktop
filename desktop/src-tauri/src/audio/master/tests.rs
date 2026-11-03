use std::fmt::Debug;
use std::num::NonZero;
use std::sync::Arc;
use std::sync::mpsc::TryRecvError;

use cpal::{FromSample, I24, Sample, SizedSample, U24};
use rodio::buffer::SamplesBuffer;
use rodio::mixer::{Mixer, MixerSource};

use super::ring::Ring;
use super::*;

const RATE: u32 = 48_000;

struct Rig {
    master: Arc<Master>,
    music: Mixer,
    render: Render,
}

fn mixer(channels: u16, rate: u32) -> (Mixer, MixerSource) {
    rodio::mixer::mixer(NonZero::new(channels).unwrap(), NonZero::new(rate).unwrap())
}

fn rig_at(master: Arc<Master>, channels: u16, rate: u32) -> Rig {
    let (music, music_out) = mixer(channels, rate);
    let (voice, voice_out) = mixer(channels, rate);
    master.set_voice(voice);
    let render = Render::new(master.clone(), music_out, voice_out);
    Rig {
        master,
        music,
        render,
    }
}

fn rig(channels: u16) -> Rig {
    rig_at(Master::new(), channels, RATE)
}

fn buffer(channels: u16, samples: Vec<f32>) -> SamplesBuffer {
    SamplesBuffer::new(
        NonZero::new(channels).unwrap(),
        NonZero::new(RATE).unwrap(),
        samples,
    )
}

fn steady(channels: u16, frame: &[f32], frames: usize) -> SamplesBuffer {
    buffer(channels, frame.repeat(frames))
}

fn noise(len: usize) -> Vec<f32> {
    let mut seed = 0x2545_f491u32;
    (0..len)
        .map(|_| {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            (seed as f32 / u32::MAX as f32) * 2.4 - 1.2
        })
        .collect()
}

fn fill(render: &mut Render, len: usize) -> Vec<f32> {
    let mut out = vec![0.0; len];
    render.fill(&mut out);
    out
}

fn rodio_fill<T: SizedSample + FromSample<f32>>(source: &mut MixerSource, data: &mut [T]) {
    for out in data.iter_mut() {
        *out = source
            .next()
            .map(Sample::from_sample)
            .unwrap_or(T::EQUILIBRIUM);
    }
}

fn matches_rodio<T>()
where
    T: SizedSample + FromSample<f32> + PartialEq + Debug,
{
    let samples = noise(9_000);
    let mut rig = rig(2);
    rig.music.add(buffer(2, samples.clone()));
    let (theirs, mut their_out) = mixer(2, RATE);
    theirs.add(buffer(2, samples));
    for len in [512, 7, 1_000, 3, 4_096, 2_048, 64] {
        let mut ours = vec![T::EQUILIBRIUM; len];
        let mut expected = vec![T::EQUILIBRIUM; len];
        rig.render.fill(&mut ours);
        rodio_fill(&mut their_out, &mut expected);
        assert_eq!(ours, expected);
    }
}

#[test]
fn voice_off_output_is_what_rodio_wrote_in_every_format() {
    matches_rodio::<f32>();
    matches_rodio::<f64>();
    matches_rodio::<i8>();
    matches_rodio::<i16>();
    matches_rodio::<I24>();
    matches_rodio::<i32>();
    matches_rodio::<i64>();
    matches_rodio::<u8>();
    matches_rodio::<u16>();
    matches_rodio::<U24>();
    matches_rodio::<u32>();
    matches_rodio::<u64>();
}

#[test]
fn voice_off_f32_output_is_bit_exact() {
    let samples = noise(4_800);
    let mut rig = rig(2);
    rig.music.add(buffer(2, samples.clone()));
    let out = fill(&mut rig.render, 4_800);
    let bits = |values: &[f32]| values.iter().map(|v| v.to_bits()).collect::<Vec<_>>();
    assert_eq!(bits(&out), bits(&samples));
}

#[test]
fn samples_convert_to_the_device_format() {
    let mut rig = rig(1);
    rig.music.add(buffer(1, vec![0.5, -0.5, 1.0, -1.0, 0.0]));
    let mut ints = [0i16; 6];
    rig.render.fill(&mut ints);
    assert_eq!(ints, [16_384, -16_384, i16::MAX, i16::MIN, 0, 0]);

    rig.music.add(buffer(1, vec![0.5, -1.0]));
    let mut unsigned = [0u8; 3];
    rig.render.fill(&mut unsigned);
    assert_eq!(unsigned, [192, 0, 128]);
}

#[test]
fn duck_glides_down_in_about_120_ms_and_back() {
    let mut rig = rig(1);
    rig.music.add(steady(1, &[1.0], RATE as usize));
    rig.master.set_duck(0.25);
    let down = fill(&mut rig.render, RATE as usize / 2);

    let at = |ms: usize| down[RATE as usize / 1_000 * ms];
    assert!(down[0] < 1.0);
    assert!(at(30) > 0.25 + 0.75 * 0.4);
    assert!(at(120) < 0.25 + 0.75 * 0.06);
    assert_eq!(at(450), 0.25);
    assert!(down.windows(2).all(|w| w[1] <= w[0] && w[0] - w[1] < 1e-3));

    rig.master.set_duck(1.0);
    let up = fill(&mut rig.render, RATE as usize / 2);
    assert!(up.windows(2).all(|w| w[1] >= w[0] && w[1] - w[0] < 1e-3));
    assert_eq!(up[up.len() - 1].to_bits(), 1.0f32.to_bits());
}

#[test]
fn duck_level_is_clamped() {
    let mut rig = rig(1);
    rig.music.add(steady(1, &[1.0], RATE as usize));
    rig.master.set_duck(3.0);
    assert!(fill(&mut rig.render, 4_800).iter().all(|&v| v == 1.0));
    rig.master.set_duck(-1.0);
    assert_eq!(fill(&mut rig.render, RATE as usize / 2).last(), Some(&0.0));
}

#[test]
fn every_channel_of_a_frame_gets_the_same_gain() {
    let mut rig = rig(2);
    rig.music.add(steady(2, &[1.0, 1.0], RATE as usize));
    rig.master.set_duck(0.25);
    let out = fill(&mut rig.render, 9_601);
    assert!(out[..9_600].chunks(2).all(|frame| frame[0] == frame[1]));
}

#[test]
fn new_output_starts_at_the_current_duck() {
    let master = Master::new();
    master.set_duck(0.25);
    let mut rig = rig_at(master, 2, RATE);
    rig.music.add(steady(2, &[1.0, 1.0], 100));
    assert!(fill(&mut rig.render, 200).iter().all(|&v| v == 0.25));
}

#[test]
fn reference_costs_nothing_until_attached() {
    let mut rig = rig(2);
    rig.music.add(steady(2, &[0.5, 0.25], 4_800));
    fill(&mut rig.render, 4_800);
    assert!(rig.master.reference.get().is_none());
}

#[test]
fn reference_is_the_mono_mix_while_attached() {
    let mut rig = rig(2);
    rig.music.add(steady(2, &[0.5, 0.25], 4_800));
    let mut reference = rig.master.attach_reference().unwrap();
    fill(&mut rig.render, 961);
    let mut tapped = vec![0.0; 1_000];
    assert_eq!(reference.read(&mut tapped), 480);
    assert!(tapped[..480].iter().all(|&v| v == 0.375));

    fill(&mut rig.render, 1);
    assert_eq!(reference.read(&mut tapped), 1);
    assert_eq!(tapped[0], 0.375);
}

#[test]
fn detached_reference_stops_and_reattach_starts_clean() {
    let mut rig = rig(1);
    rig.music.add(steady(1, &[0.5], 4_800));
    let reference = rig.master.attach_reference().unwrap();
    fill(&mut rig.render, 100);
    drop(reference);
    fill(&mut rig.render, 100);
    let mut again = rig.master.attach_reference().unwrap();
    let mut tapped = vec![0.0; 1_000];
    assert_eq!(again.read(&mut tapped), 0);
    fill(&mut rig.render, 50);
    assert_eq!(again.read(&mut tapped), 50);
}

#[test]
fn reference_has_one_consumer_at_a_time() {
    let master = Master::new();
    let first = master.attach_reference();
    assert!(first.is_some());
    assert!(master.attach_reference().is_none());
    drop(first);
    assert!(master.attach_reference().is_some());
}

#[test]
fn reference_rate_is_the_output_rate() {
    let rig = rig_at(Master::new(), 2, 44_100);
    let reference = rig.master.attach_reference().unwrap();
    assert_eq!(reference.sample_rate(), 44_100);
}

#[test]
fn reference_is_post_duck_and_includes_speech() {
    let master = Master::new();
    master.set_duck(0.5);
    let mut rig = rig_at(master, 1, RATE);
    rig.music.add(steady(1, &[1.0], 4_800));
    let mut reference = rig.master.attach_reference().unwrap();
    let speech = rig.master.speak(steady(1, &[0.25], 1_000));
    let out = fill(&mut rig.render, 1_000);
    assert!(out.iter().all(|&v| v == 0.75));
    let mut tapped = vec![0.0; 2_000];
    assert_eq!(reference.read(&mut tapped), 1_000);
    assert!(tapped[..1_000].iter().all(|&v| v == 0.75));
    assert_eq!(fill(&mut rig.render, 1)[0], 0.5);
    assert_eq!(speech.ended().try_recv(), Ok(()));
}

#[test]
fn speech_ends_after_its_last_sample() {
    let mut rig = rig(2);
    let speech = rig.master.speak(steady(1, &[0.1], 100));
    fill(&mut rig.render, 100);
    assert_eq!(speech.ended().try_recv(), Err(TryRecvError::Empty));
    fill(&mut rig.render, 102);
    assert_eq!(speech.ended().try_recv(), Ok(()));
    assert!(!rig.master.is_speaking());
}

#[test]
fn stopped_speech_ends_at_once() {
    let mut rig = rig(1);
    rig.music.add(steady(1, &[0.5], 4_800));
    let speech = rig.master.speak(steady(1, &[0.25], RATE as usize));
    assert!(fill(&mut rig.render, 10).iter().all(|&v| v == 0.75));
    speech.stop();
    assert!(fill(&mut rig.render, 10).iter().all(|&v| v == 0.5));
    assert_eq!(speech.ended().try_recv(), Ok(()));
}

#[test]
fn speech_ends_when_the_output_goes_away() {
    let rig = rig(2);
    let speech = rig.master.speak(steady(1, &[0.1], RATE as usize));
    drop(rig.render);
    assert_eq!(speech.ended().try_recv(), Ok(()));
    assert!(!rig.master.is_speaking());
}

#[test]
fn speech_without_an_output_ends_at_once() {
    let master = Master::new();
    let speech = master.speak(steady(1, &[0.1], 100));
    assert_eq!(speech.ended().try_recv(), Ok(()));
    assert!(!master.is_speaking());
}

#[test]
fn speech_started_mid_callback_keeps_channels_in_place() {
    let mut rig = rig(2);
    fill(&mut rig.render, 3);
    rig.master.speak(steady(2, &[0.5, -0.5], 64));
    let mut out = vec![0.0; 3];
    for len in [7, 9, 5, 11, 64, 50] {
        out.extend(fill(&mut rig.render, len));
    }
    let left = out.iter().step_by(2);
    let right = out.iter().skip(1).step_by(2);
    assert!(left.clone().all(|&v| v == 0.0 || v == 0.5));
    assert!(right.clone().all(|&v| v == 0.0 || v == -0.5));
    assert_eq!(left.filter(|&&v| v == 0.5).count(), 64);
    assert_eq!(right.filter(|&&v| v == -0.5).count(), 64);
}

#[test]
fn ring_keeps_order_across_the_wrap_and_drops_on_overflow() {
    let ring = Ring::new(8);
    assert_eq!(ring.push(&[1.0, 2.0, 3.0, 4.0, 5.0]), 5);
    let mut out = [0.0; 8];
    assert_eq!(ring.pop(&mut out[..3]), 3);
    assert_eq!(out[..3], [1.0, 2.0, 3.0]);
    assert_eq!(ring.push(&[6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0]), 6);
    assert_eq!(ring.pop(&mut out), 8);
    assert_eq!(out, [4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0]);
    assert_eq!(ring.pop(&mut out), 0);
}

#[test]
fn ring_hands_samples_across_threads_in_order() {
    let ring = Arc::new(Ring::new(256));
    let producer = {
        let ring = ring.clone();
        std::thread::spawn(move || {
            let mut next = 0u32;
            while next < 100_000 {
                let chunk: Vec<f32> = (next..(next + 37).min(100_000)).map(|v| v as f32).collect();
                next += ring.push(&chunk) as u32;
            }
        })
    };
    let mut expected = 0u32;
    let mut out = [0.0; 64];
    while expected < 100_000 {
        let count = ring.pop(&mut out);
        for &value in &out[..count] {
            assert_eq!(value, expected as f32);
            expected += 1;
        }
    }
    producer.join().unwrap();
}
