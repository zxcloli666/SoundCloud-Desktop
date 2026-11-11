use std::path::PathBuf;
use std::time::Instant;

use voice_qwen::{Engine, Launch, Paths, Qwen, Request, Sink};

struct Heard {
    samples: Vec<f32>,
    chunks: usize,
    stop_after: usize,
    first: Option<Instant>,
}

impl Sink for Heard {
    fn audio(&mut self, samples: Vec<f32>) {
        self.first.get_or_insert_with(Instant::now);
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
        first: None,
    }
}

fn paths() -> Option<Paths> {
    let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let paths = Paths {
        program: path("SCD_QWEN")?,
        talker: path("SCD_QWEN_TALKER")?,
        codec: path("SCD_QWEN_CODEC")?,
    };
    Some(paths)
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
fn the_voice_speaks_stops_and_survives_a_bad_request() {
    let Some(paths) = paths() else {
        eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
        return;
    };
    let speaker = speaker();
    let mut qwen = Qwen::default();
    let asked = Instant::now();
    let device = qwen.device(&paths).expect("engine starts");
    eprintln!(
        "starts on {device} in {:.2} s",
        asked.elapsed().as_secs_f32()
    );

    let mut whole = heard(usize::MAX);
    let started = Instant::now();
    qwen.say(
        &paths,
        &request("Включаю Скриптонита.", &speaker),
        &mut whole,
    )
    .expect("speaks");
    let seconds = whole.samples.len() as f32 / 24000.0;
    let first = whole.first.expect("sound").duration_since(started);
    eprintln!(
        "{seconds:.2} s of audio in {:.2} s, the first sound after {:.2} s",
        started.elapsed().as_secs_f32(),
        first.as_secs_f32()
    );
    for trouble in qwen.troubles() {
        eprintln!("{trouble}");
    }
    eprintln!("runs on {}", qwen.device(&paths).expect("engine runs"));
    assert!((0.8..6.0).contains(&seconds), "{seconds}");
    let peak = whole.samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    assert!(peak > 0.05 && peak <= 1.5, "{peak}");

    let mut cut = heard(2);
    let long = "Это длинная фраза, которую остановят на середине, потому что слушать её целиком \
                никто не хочет.";
    qwen.say(&paths, &request(long, &speaker), &mut cut)
        .expect("a stopped phrase still ends cleanly");
    assert!(
        cut.samples.len() < whole.samples.len() * 2,
        "{}",
        cut.samples.len()
    );

    let refused = qwen.say(
        &paths,
        &request("Привет.", "nobody"),
        &mut heard(usize::MAX),
    );
    let refused = refused.expect_err("an unknown speaker is refused");
    assert!(refused.contains("refused"), "{refused}");

    let mut again = heard(usize::MAX);
    qwen.say(&paths, &request("Готово.", &speaker), &mut again)
        .expect("speaks after a refusal");
    assert!(!again.samples.is_empty());
    assert!(qwen.troubles().is_empty());
}

#[test]
fn a_missing_device_is_an_error_not_a_hang() {
    let Some(paths) = paths() else {
        return;
    };
    let launch = Launch {
        program: paths.program,
        talker: paths.talker,
        codec: paths.codec,
        device: Some("Nope0".into()),
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
