#[path = "aec_bench/audio.rs"]
mod audio;
#[path = "aec_bench/echo_path.rs"]
mod echo_path;
#[path = "aec_bench/engine.rs"]
mod engine;
#[path = "aec_bench/metrics.rs"]
mod metrics;
#[path = "aec_bench/sim.rs"]
mod sim;

use std::collections::HashMap;
use std::path::PathBuf;

use voice_audio::aec::AecConfig;

use audio::{db, load_mono, power, resample, scale_to_db};
use metrics::{Layout, erle_blocks, mean, percentile, settle_seconds, si_sdr};
use sim::Drift;

const SPEECH_DBFS: f64 = -26.0;
const NOISE_DBFS: f64 = -50.0;
const MUSIC_DBFS: f64 = -16.0;
const SETTLE_SECONDS: usize = 10;

struct Args {
    engine: String,
    rate: u32,
    seconds: usize,
    noise_suppression: bool,
    steer: bool,
    silent_reference: bool,
    music_stops: Option<usize>,
    music: PathBuf,
    speech_dir: PathBuf,
    delays: Vec<u32>,
    rt60: Vec<f32>,
    esr: Vec<f64>,
    drift: Vec<f64>,
    music_offset: usize,
}

fn list<T: std::str::FromStr>(text: &str) -> Vec<T> {
    text.split(',').map(|v| v.parse().ok().unwrap()).collect()
}

fn parse_args() -> Args {
    let mut args = Args {
        engine: "sonora".into(),
        rate: 48_000,
        seconds: 90,
        noise_suppression: false,
        steer: false,
        silent_reference: false,
        music_stops: None,
        music: ".cache/music/wildthing.wav".into(),
        speech_dir: ".cache/speech".into(),
        delays: vec![50, 120],
        rt60: vec![0.3, 0.6],
        esr: vec![0.0, 10.0],
        drift: vec![0.0, 100.0, -200.0],
        music_offset: 20,
    };
    let mut it = std::env::args().skip(1);
    while let Some(flag) = it.next() {
        match flag.as_str() {
            "--ns" => args.noise_suppression = true,
            "--steer" => args.steer = true,
            "--silent-reference" => args.silent_reference = true,
            other => {
                let value = it.next().unwrap();
                match other {
                    "--engine" => args.engine = value,
                    "--rate" => args.rate = value.parse().unwrap(),
                    "--seconds" => args.seconds = value.parse().unwrap(),
                    "--music" => args.music = value.into(),
                    "--speech-dir" => args.speech_dir = value.into(),
                    "--delays" => args.delays = list(&value),
                    "--rt60" => args.rt60 = list(&value),
                    "--esr" => args.esr = list(&value),
                    "--drift" => args.drift = list(&value),
                    "--music-stops" => args.music_stops = Some(value.parse().unwrap()),
                    "--music-offset" => args.music_offset = value.parse().unwrap(),
                    _ => panic!("unknown flag {other}"),
                }
            }
        }
    }
    args
}

fn speech_track(dir: &PathBuf, rate: u32, layout: &Layout) -> Vec<f32> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "wav"))
        .filter(|p| p.file_stem().is_some_and(|s| s != "intro"))
        .collect();
    files.sort();
    let (start, end) = layout.double_talk();
    let gap = (rate as f64 * 0.4) as usize;
    let mut track = vec![0.0f32; layout.total];
    let mut pos = start;
    'fill: for file in files {
        for sample in load_mono(&file, rate) {
            if pos >= end {
                break 'fill;
            }
            track[pos] = sample;
            pos += 1;
        }
        pos += gap;
    }
    let active: Vec<f32> = track[start..end]
        .chunks(rate as usize / 100)
        .filter(|c| power(c) > 1e-8)
        .flatten()
        .copied()
        .collect();
    let gain = 10f64.powf(SPEECH_DBFS / 20.0) / power(&active).sqrt();
    track
        .iter_mut()
        .for_each(|v| *v = (*v as f64 * gain) as f32);
    track
}

struct Row {
    erle_mean: f64,
    erle_p10: f64,
    converge: f64,
    erle_first: f64,
    residual_over_noise: f64,
    si_in: f64,
    si_out: f64,
    speech_gain: f64,
    cpu_ms_per_s: f64,
    sync_ms_per_s: f64,
    glitches: u32,
    final_ppm: f32,
}

fn main() {
    let args = parse_args();
    let rate = args.rate;
    let total = args.seconds * rate as usize;
    let layout = Layout {
        rate: rate as usize,
        total,
    };
    let pad = total / 50;

    let music_full = load_mono(&args.music, rate);
    let offset = args.music_offset * rate as usize;
    let mut reference = music_full[offset..offset + total + pad].to_vec();
    scale_to_db(&mut reference, MUSIC_DBFS);
    if let Some(stop) = args.music_stops {
        reference[stop * rate as usize..].fill(0.0);
    }
    if args.silent_reference {
        reference.fill(0.0);
    }
    let speech = speech_track(&args.speech_dir, rate, &layout);
    let mut noise = echo_path::white_noise(total, 99);
    scale_to_db(&mut noise, NOISE_DBFS);
    let noise_power = power(&noise);

    println!(
        "engine={} rate={} seconds={} ns={} steer={}",
        args.engine, rate, args.seconds, args.noise_suppression, args.steer
    );
    println!(
        "| delay ms | rt60 | ESR dB | drift ppm | ERLE mean | ERLE p10 | ERLE 0-2 s | settle s | resid-noise dB | SI-SDR in | SI-SDR out | speech gain dB | CPU ms/s | sync ms/s | glitches | ppm |"
    );
    println!("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

    let transparent = transparent_output(&args, &speech, &noise);

    let mut echoes: HashMap<(u32, u32), Vec<f32>> = HashMap::new();
    let mut rows = Vec::new();
    for &delay_ms in &args.delays {
        for &rt60 in &args.rt60 {
            let key = (delay_ms, (rt60 * 100.0) as u32);
            let echo_play = echoes
                .entry(key)
                .or_insert_with(|| {
                    echo_path::echo_at_speaker_clock(&reference, rate, delay_ms, rt60)
                })
                .clone();
            for &drift_ppm in &args.drift {
                let echo_cap = if drift_ppm == 0.0 {
                    echo_play[..total].to_vec()
                } else {
                    let mut moved = resample(&echo_play, 1.0 + drift_ppm * 1e-6);
                    moved.resize(total, 0.0);
                    moved.truncate(total);
                    moved
                };
                for &esr in &args.esr {
                    let mut echo = echo_cap.clone();
                    scale_to_db(&mut echo, SPEECH_DBFS + esr);
                    let mic: Vec<f32> = (0..total)
                        .map(|i| (echo[i] + speech[i] + noise[i]).clamp(-1.0, 1.0))
                        .collect();
                    let config = AecConfig {
                        sample_rate: rate,
                        noise_suppression: args.noise_suppression,
                        delay_ms: None,
                    };
                    let drift = Drift {
                        ppm: drift_ppm,
                        steer: args.steer,
                    };
                    let run = sim::run(&args.engine, config, &reference, &mic, &drift);
                    let row = measure(&layout, &mic, &speech, &run, noise_power, &transparent);
                    println!(
                        "| {} | {} | {} | {:+} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {} | {:+.0} |",
                        delay_ms,
                        rt60,
                        esr,
                        drift_ppm,
                        row.erle_mean,
                        row.erle_p10,
                        row.erle_first,
                        row.converge,
                        row.residual_over_noise,
                        row.si_in,
                        row.si_out,
                        row.speech_gain,
                        row.cpu_ms_per_s,
                        row.sync_ms_per_s,
                        row.glitches,
                        row.final_ppm,
                    );
                    rows.push((delay_ms, rt60, esr, drift_ppm, row));
                }
            }
        }
    }
    summary(&rows);
}

fn transparent_output(args: &Args, speech: &[f32], noise: &[f32]) -> Vec<f32> {
    let mic: Vec<f32> = speech.iter().zip(noise).map(|(s, n)| s + n).collect();
    let config = AecConfig {
        sample_rate: args.rate,
        noise_suppression: args.noise_suppression,
        delay_ms: None,
    };
    let silent_reference = vec![0.0f32; mic.len() * 2];
    let drift = Drift {
        ppm: 0.0,
        steer: false,
    };
    sim::run(&args.engine, config, &silent_reference, &mic, &drift).out
}

fn measure(
    layout: &Layout,
    mic: &[f32],
    speech: &[f32],
    run: &sim::RunOutput,
    noise_power: f64,
    transparent: &[f32],
) -> Row {
    let rate = layout.rate;
    let half = rate / 2;
    let one = rate;
    let (a0, a1) = layout.music_only_a();
    let (c0, c1) = layout.music_only_c();
    let (b0, b1) = layout.double_talk();

    let early = erle_blocks(mic, &run.out, (a0, a1), half);
    if std::env::var("TRACE").is_ok() {
        eprintln!(
            "{:?}",
            early
                .iter()
                .take(40)
                .map(|e| e.round() as i32)
                .collect::<Vec<_>>()
        );
    }
    let converge = settle_seconds(&early, 0.5, 15.0);
    let erle_first = mean(&early[..4]);

    let settle = SETTLE_SECONDS * rate;
    let mut blocks = erle_blocks(mic, &run.out, (a0 + settle, a1), one);
    blocks.extend(erle_blocks(mic, &run.out, (c0, c1), one));

    let mut out_power = power(&run.out[a0 + settle..a1]) * (a1 - a0 - settle) as f64;
    out_power += power(&run.out[c0..c1]) * (c1 - c0) as f64;
    out_power /= (a1 - a0 - settle + c1 - c0) as f64;

    let (si_out, gain) = si_sdr(&run.out[b0..b1], &transparent[b0..b1]);
    let (si_in, _) = si_sdr(&mic[b0..b1], &speech[b0..b1]);
    let audio_seconds = (layout.total / rate) as f64;

    Row {
        erle_mean: mean(&blocks),
        erle_p10: percentile(&blocks, 0.1),
        converge,
        erle_first,
        residual_over_noise: db(out_power) - db(noise_power),
        si_in,
        si_out,
        speech_gain: gain,
        cpu_ms_per_s: run.engine_time.as_secs_f64() * 1000.0 / audio_seconds,
        sync_ms_per_s: run.sync_time.as_secs_f64() * 1000.0 / audio_seconds,
        glitches: run.underruns + run.overruns,
        final_ppm: run.final_ppm,
    }
}

fn summary(rows: &[(u32, f32, f64, f64, Row)]) {
    println!();
    println!(
        "| drift ppm | ERLE mean | ERLE p10 | settle s (median) | ERLE 0-2 s | SI-SDR out | dSI-SDR | speech gain dB | CPU ms/s |"
    );
    println!("|---|---|---|---|---|---|---|---|---|");
    let mut drifts: Vec<f64> = rows.iter().map(|r| r.3).collect();
    drifts.dedup();
    drifts.sort_by(|a, b| a.partial_cmp(b).unwrap());
    drifts.dedup();
    for d in drifts {
        let group: Vec<&Row> = rows.iter().filter(|r| r.3 == d).map(|r| &r.4).collect();
        let pick = |f: fn(&Row) -> f64| mean(&group.iter().map(|r| f(r)).collect::<Vec<_>>());
        let mut conv: Vec<f64> = group.iter().map(|r| r.converge).collect();
        conv.sort_by(|a, b| a.partial_cmp(b).unwrap());
        println!(
            "| {:+} | {:.1} | {:.1} | {:.1} | {:.1} | {:.1} | {:+.1} | {:.1} | {:.1} |",
            d,
            pick(|r| r.erle_mean),
            pick(|r| r.erle_p10),
            conv[conv.len() / 2],
            pick(|r| r.erle_first),
            pick(|r| r.si_out),
            pick(|r| r.si_out - r.si_in),
            pick(|r| r.speech_gain),
            pick(|r| r.cpu_ms_per_s),
        );
    }
}
