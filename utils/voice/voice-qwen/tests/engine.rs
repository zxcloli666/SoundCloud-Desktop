use std::path::PathBuf;
use std::time::Instant;

use voice_qwen::{Engine, Error, Launch, Request, Sink};

struct Heard {
    samples: Vec<f32>,
    chunks: usize,
    stop_after: usize,
}

impl Sink for Heard {
    fn audio(&mut self, samples: Vec<f32>) {
        self.chunks += 1;
        self.samples.extend(samples);
    }

    fn wanted(&self) -> bool {
        self.chunks < self.stop_after
    }
}

fn heard(stop_after: usize) -> Heard {
    Heard {
        samples: Vec::new(),
        chunks: 0,
        stop_after,
    }
}

fn launch(device: Option<&str>) -> Option<Launch> {
    let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let launch = Launch {
        program: path("SCD_QWEN")?,
        talker: path("SCD_QWEN_TALKER")?,
        codec: path("SCD_QWEN_CODEC")?,
        device: device.map(str::to_string),
    };
    Some(launch)
}

fn request<'a>(text: &'a str, speaker: &'a str) -> Request<'a> {
    Request {
        text,
        speaker,
        lang: "auto",
        seed: 1,
        max_tokens: 300,
    }
}

fn speaker() -> String {
    std::env::var("SCD_QWEN_SPEAKER").unwrap_or_else(|_| "loli".into())
}

#[test]
fn the_engine_speaks_stops_and_survives_a_bad_request() {
    let Some(launch) = launch(None) else {
        eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
        return;
    };
    let speaker = speaker();
    let mut engine = Engine::start(&launch).expect("engine starts");
    assert_eq!(engine.rate(), 24000);
    assert!(!engine.device().is_empty());
    eprintln!("runs on {}", engine.device());

    let mut whole = heard(usize::MAX);
    let started = Instant::now();
    engine
        .say(&request("Включаю Скриптонита.", &speaker), &mut whole)
        .expect("speaks");
    let seconds = whole.samples.len() as f32 / 24000.0;
    eprintln!("{seconds:.2} s of audio in {:.2} s", started.elapsed().as_secs_f32());
    assert!((0.8..6.0).contains(&seconds), "{seconds}");
    let peak = whole.samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    assert!(peak > 0.05 && peak <= 1.5, "{peak}");

    let mut cut = heard(2);
    engine
        .say(
            &request(
                "Это длинная фраза, которую остановят на середине, потому что слушать её целиком никто не хочет.",
                &speaker,
            ),
            &mut cut,
        )
        .expect("a stopped phrase still ends cleanly");
    assert!(cut.samples.len() < whole.samples.len() * 2, "{}", cut.samples.len());

    let refused = engine.say(&request("Привет.", "nobody"), &mut heard(usize::MAX));
    assert!(matches!(refused, Err(Error::Refused(_))), "{refused:?}");

    let mut again = heard(usize::MAX);
    engine
        .say(&request("Готово.", &speaker), &mut again)
        .expect("speaks after a refusal");
    assert!(!again.samples.is_empty());
}

#[test]
fn a_missing_device_is_an_error_not_a_hang() {
    let Some(launch) = launch(Some("Nope0")) else {
        return;
    };
    let started = Instant::now();
    let error = Engine::start(&launch).err().expect("no such device");
    eprintln!("{error}");
    assert!(started.elapsed().as_secs() < 30);
}

#[test]
fn a_missing_program_is_an_error() {
    let launch = Launch {
        program: PathBuf::from("/nonexistent/scd-qwen"),
        talker: PathBuf::from("talker.gguf"),
        codec: PathBuf::from("codec.gguf"),
        device: None,
    };
    assert!(Engine::start(&launch).is_err());
}
