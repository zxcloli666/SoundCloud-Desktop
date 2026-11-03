use std::env;
use std::path::PathBuf;
use std::time::Instant;

use voice_speech::{Event, Listener, Options, SAMPLE_RATE, read_mono, to_16k};

const CHUNK: usize = SAMPLE_RATE as usize / 10;

fn main() {
    let mut args = env::args().skip(1);
    let models = PathBuf::from(
        args.next()
            .expect("usage: transcribe <models dir> <hotwords|-> <wav>..."),
    );
    let hotwords = args.next().expect("hotwords file or -");
    let wavs: Vec<String> = args.collect();

    let hotwords: Vec<String> = if hotwords == "-" {
        Vec::new()
    } else {
        std::fs::read_to_string(&hotwords)
            .expect("hotwords file")
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(String::from)
            .collect()
    };

    let options = Options {
        vad_model: models.join("silero_vad.onnx"),
        asr_dir: models.join("asr"),
        threads: 2,
        hotwords,
        hotwords_score: env::var("HOTWORDS_SCORE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(1.5),
    };
    let mut listener = Listener::open(&options).expect("open");

    let mut audio_seconds = 0.0;
    let mut spent = 0.0;
    for wav in &wavs {
        let (samples, rate) = read_mono(wav.as_ref()).expect("wav");
        let samples = to_16k(&samples, rate).expect("resample");
        let seconds = samples.len() as f64 / SAMPLE_RATE as f64;
        println!("== {wav} ({seconds:.2}s from {rate} Hz)");

        let started = Instant::now();
        let mut events = Vec::new();
        for chunk in samples.chunks(CHUNK) {
            events.extend(listener.push(chunk));
        }
        events.extend(listener.push(&vec![0.0; SAMPLE_RATE as usize]));
        events.extend(listener.finish());
        spent += started.elapsed().as_secs_f64();
        audio_seconds += seconds;

        for event in events {
            match event {
                Event::Partial(text) => println!("  partial: {text}"),
                Event::Final(text) => println!("  final: {text}"),
            }
        }
    }
    println!(
        "audio {audio_seconds:.2}s, compute {spent:.2}s, rtf {:.3}",
        spent / audio_seconds
    );
}
