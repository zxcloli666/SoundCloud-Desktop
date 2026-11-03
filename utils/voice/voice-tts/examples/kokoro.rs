use std::path::Path;
use voice_g2p::en::{English, Lexicon};
use voice_g2p::kokoro::split_sentences;
use voice_tts::Kokoro;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let dir = Path::new(&args[1]);
    let model = &args[2];
    let sid: i32 = args[3].parse().unwrap();
    let out = &args[4];
    let text = args[5..].join(" ");

    let english = English::new(Lexicon::bundled());
    let phonemes = english.phonemize(&text);
    println!("{}", phonemes.text);
    if !phonemes.unknown.is_empty() {
        println!("unknown words: {:?}", phonemes.unknown);
    }
    let tts = Kokoro::open(dir, model, 2).expect("open kokoro");
    let spoken = tts.speak(&split_sentences(&phonemes.text), sid, 1.0).expect("speak");
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: spoken.sample_rate as u32,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(out, spec).unwrap();
    for s in &spoken.samples {
        writer.write_sample((s.clamp(-1.0, 1.0) * 32767.0) as i16).unwrap();
    }
    writer.finalize().unwrap();
    println!(
        "audio {:.2}s compute {:.2}s rtf {:.3}",
        spoken.seconds_of_audio,
        spoken.seconds_of_compute,
        spoken.seconds_of_compute / spoken.seconds_of_audio
    );
}
