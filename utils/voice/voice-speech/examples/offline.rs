use std::env;
use std::path::PathBuf;
use std::time::Instant;

use sherpa_onnx::{OfflineRecognizer, OfflineRecognizerConfig};
use voice_speech::{SAMPLE_RATE, read_mono, to_16k};

fn main() {
    let mut args = env::args().skip(1);
    let kind = args
        .next()
        .expect("usage: offline <gigaam|zipformer> <model dir> <wav>...");
    let dir = PathBuf::from(args.next().expect("model dir"));
    let wavs: Vec<String> = args.collect();
    let file = |name: &str| Some(dir.join(name).display().to_string());

    let mut config = OfflineRecognizerConfig::default();
    config.model_config.tokens = file("tokens.txt");
    config.model_config.num_threads = 2;
    config.decoding_method = Some("greedy_search".into());
    match kind.as_str() {
        "gigaam" => {
            config.model_config.transducer.encoder = file("encoder.int8.onnx");
            config.model_config.transducer.decoder = file("decoder.onnx");
            config.model_config.transducer.joiner = file("joiner.onnx");
            config.model_config.model_type = Some("nemo_transducer".into());
        }
        _ => {
            config.model_config.transducer.encoder = file("encoder.int8.onnx");
            config.model_config.transducer.decoder = file("decoder.onnx");
            config.model_config.transducer.joiner = file("joiner.int8.onnx");
        }
    }
    let loaded = Instant::now();
    let recognizer = OfflineRecognizer::create(&config).expect("model");
    println!("load {:.2}s", loaded.elapsed().as_secs_f64());

    let mut audio_seconds = 0.0;
    let mut spent = 0.0;
    for wav in &wavs {
        let (samples, rate) = read_mono(wav.as_ref()).expect("wav");
        let samples = to_16k(&samples, rate).expect("resample");
        let seconds = samples.len() as f64 / SAMPLE_RATE as f64;
        let started = Instant::now();
        let stream = recognizer.create_stream();
        stream.accept_waveform(SAMPLE_RATE, &samples);
        recognizer.decode(&stream);
        let text = stream.get_result().map(|r| r.text).unwrap_or_default();
        spent += started.elapsed().as_secs_f64();
        audio_seconds += seconds;
        println!("== {wav} ({seconds:.2}s)\n  final: {}", text.trim());
    }
    println!(
        "audio {audio_seconds:.2}s, compute {spent:.2}s, rtf {:.3}",
        spent / audio_seconds
    );
}
