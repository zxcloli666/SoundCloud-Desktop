use std::time::{Duration, Instant};

use voice_audio::aec::AecConfig;
use voice_audio::ref_sync::RefSync;

use crate::engine::Engine;

pub struct Drift {
    pub ppm: f64,
    pub steer: bool,
}

pub struct RunOutput {
    pub out: Vec<f32>,
    pub engine_time: Duration,
    pub sync_time: Duration,
    pub underruns: u32,
    pub overruns: u32,
    pub final_ppm: f32,
}

const SYNC_TARGET_MS: u32 = 16;

pub fn run(
    engine_name: &str,
    config: AecConfig,
    reference: &[f32],
    mic: &[f32],
    drift: &Drift,
) -> RunOutput {
    let mut engine = Engine::new(engine_name, config).unwrap();
    let mut sync = RefSync::new(config.sample_rate, SYNC_TARGET_MS, drift.steer);
    let frame = config.frame_len();
    let chunk = (config.sample_rate as f64 * 0.0107) as usize;
    let frames = mic.len() / frame;
    let ratio = 1.0 + drift.ppm * 1e-6;

    let mut out = vec![0.0f32; frames * frame];
    let mut render = vec![0.0f32; frame];
    let mut delivered = 0usize;
    let mut engine_time = Duration::ZERO;
    let mut sync_time = Duration::ZERO;

    for i in 0..frames {
        let available = (((i + 1) * frame) as f64 / ratio) as usize / chunk * chunk;
        let started = Instant::now();
        if available > delivered {
            sync.push(&reference[delivered..available]);
            delivered = available;
        }
        sync.pull(&mut render);
        sync_time += started.elapsed();
        if std::env::var("SYNC_TRACE").is_ok() && i % 100 == 0 {
            eprintln!(
                "{} fill {} ppm {:.0} u {} o {}",
                i,
                sync.fill(),
                sync.ratio_ppm(),
                sync.underruns,
                sync.overruns
            );
        }

        let started = Instant::now();
        engine.render(&render);
        engine.capture(
            &mic[i * frame..(i + 1) * frame],
            &mut out[i * frame..(i + 1) * frame],
        );
        engine_time += started.elapsed();
    }

    RunOutput {
        out,
        engine_time,
        sync_time,
        underruns: sync.underruns,
        overruns: sync.overruns,
        final_ppm: sync.ratio_ppm(),
    }
}
