use std::path::Path;
use voice_g2p::kokoro::{map_russian, split_sentences, Vocab};
use voice_g2p::ru::Russian;
use voice_tts::Kokoro;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let dir = Path::new(&args[1]);
    let model = &args[2];
    let sid: i32 = args[3].parse().unwrap();
    let out = &args[4];
    let text = args[5..].join(" ");

    let russian = Russian::bundled();
    let spoken = russian.speak(&text);
    println!("{}\n{}", spoken.text, spoken.ipa);

    let vocab = Vocab::from_tokens_txt(&std::fs::read_to_string(dir.join("tokens.txt")).unwrap());
    println!("missing from kokoro vocab: {:?}", vocab.missing(&spoken.ipa));
    let mapped = map_russian(&spoken.ipa);
    println!("still missing after mapping: {:?}", vocab.missing(&mapped));
    println!("{mapped}");

    let tts = Kokoro::open(dir, model, 2).expect("open kokoro");
    let audio = tts.speak(&split_sentences(&mapped), sid, 1.0).expect("speak");
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: audio.sample_rate as u32,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(out, spec).unwrap();
    for s in &audio.samples {
        writer.write_sample((s.clamp(-1.0, 1.0) * 32767.0) as i16).unwrap();
    }
    writer.finalize().unwrap();
    println!(
        "audio {:.2}s compute {:.2}s rtf {:.3}",
        audio.seconds_of_audio,
        audio.seconds_of_compute,
        audio.seconds_of_compute / audio.seconds_of_audio
    );
}
