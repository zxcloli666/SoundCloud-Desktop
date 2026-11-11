mod common;

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use common::{Rig, rig_on, silent, timing};
use voice_engine::{Chat, Command, Config, Event, KOKORO, Outcome, Source, State};
use voice_models::{Fetch, FetchError, File, Kind, Manifest, Model, Options, Response, Store};
use voice_resolve::FixtureCatalog;

const RATE: f32 = 24000.0;
const ONCE: &str = "Привет! Сейчас включу что-нибудь спокойное. Думаю, тебе понравится эта \
                    подборка, она как раз под вечернее настроение. Если захочешь что-то бодрее, \
                    просто скажи. Приятного прослушивания!";
const SLOWLY: &str = "Хорошо! Нашла для тебя три новых альбома. Первый вышел на прошлой неделе, \
                      и его уже все обсуждают. Второй потише, зато с отличным вокалом. Третий \
                      советую оставить на вечер. С какого начнём?";
const CUT: &str = "Здравствуй, это длинный ответ, который никто не дослушает до конца. Дальше \
                   идёт ещё одно предложение. И ещё одно, совсем уже лишнее.";
const NEXT: &str = "Теперь говорю другое. И это снова слышно.";
const PIECE: usize = 15;
const EVERY: Duration = Duration::from_millis(150);
const PATIENCE: Duration = Duration::from_secs(120);

struct Told {
    first_sound: Duration,
    whole: Duration,
    heard: Vec<f32>,
}

struct NoFetch;

impl Fetch for NoFetch {
    fn get(&self, _: &str, _: u64) -> Result<Response, FetchError> {
        Err(FetchError::Network("no network in tests".into()))
    }
}

fn model(root: &Path, id: &str, kind: Kind, files: &[(&str, PathBuf)]) -> Model {
    let dir = root.join(id).join("1");
    std::fs::create_dir_all(&dir).unwrap();
    let files: Vec<File> = files
        .iter()
        .map(|(name, from)| {
            std::os::unix::fs::symlink(from, dir.join(name)).unwrap();
            File {
                path: name.to_string(),
                url: String::new(),
                size: std::fs::metadata(from).unwrap().len(),
                sha256: "0".repeat(64),
                executable: kind == Kind::Engine,
            }
        })
        .collect();
    Model {
        id: id.into(),
        version: "1".into(),
        kind,
        language: "any".into(),
        license: "own".into(),
        unpacked_size: files.iter().map(|file| file.size).sum(),
        platform: None,
        requires: vec![],
        files,
    }
}

fn store(models: Vec<Model>, root: PathBuf) -> Arc<Store> {
    let manifest = Manifest::from_models(models).unwrap();
    Arc::new(Store::with_manifest(
        root,
        manifest,
        Arc::new(NoFetch),
        Options::default(),
    ))
}

fn fresh_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("voice-engine-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    root
}

fn voice_store() -> Option<Arc<Store>> {
    let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
    let (program, talker, codec) = (
        path("SCD_QWEN")?,
        path("SCD_QWEN_TALKER")?,
        path("SCD_QWEN_CODEC")?,
    );
    let root = fresh_root("qwen");
    let engine = model(
        &root,
        "qwen-engine-test",
        Kind::Engine,
        &[("scd-qwen", program)],
    );
    std::fs::write(root.join("qwen-engine-test/1/device"), "best").unwrap();
    let models = vec![
        engine,
        model(
            &root,
            "qwen-codec",
            Kind::Tts,
            &[("qwen-tokenizer-12hz-Q8_0.gguf", codec)],
        ),
        model(
            &root,
            "qwen-loli",
            Kind::Tts,
            &[("qwen-talker-1.7b-loli-Q4_K_M.gguf", talker)],
        ),
    ];
    Some(store(models, root))
}

fn kokoro_store() -> Option<Arc<Store>> {
    let from = PathBuf::from(std::env::var_os("SCD_KOKORO")?);
    let root = fresh_root("kokoro");
    let files = ["model.int8.onnx", "tokens.txt", "voices.bin"].map(|name| (name, from.join(name)));
    Some(store(vec![model(&root, KOKORO, Kind::Tts, &files)], root))
}

fn speaking_rig(voice: &str) -> Option<Rig> {
    let Some(store) = voice_store() else {
        eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
        return None;
    };
    Some(rig_with_voice(store, voice))
}

fn rig_with_voice(store: Arc<Store>, voice: &str) -> Rig {
    let mut patient = timing();
    patient.synth = Duration::from_secs(90);
    let rig = rig_on(
        silent(),
        Arc::new(FixtureCatalog::from_tsv(common::CATALOG, true)),
        store,
        patient,
    );
    let mut config = Config {
        enabled: true,
        ..Config::default()
    };
    config.speak.voice = voice.into();
    rig.engine.send(Command::Apply(Box::new(config)));
    rig
}

fn reply(rig: &Rig, speech: &str) -> (Duration, usize) {
    rig.engine.send(Command::Text {
        text: "пауза".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    let asked = Instant::now();
    rig.done(&command.id, speech);
    rig.expect_state(State::Speaking);
    let lead = asked.elapsed();
    rig.expect_state(State::Idle);
    let spoken = rig
        .calls
        .list()
        .iter()
        .rev()
        .find_map(|call| {
            let count = call.strip_prefix("speak ")?.strip_suffix(" at 24000")?;
            count.parse::<usize>().ok()
        })
        .expect("spoken at 24 kHz");
    (lead, spoken)
}

#[test]
fn a_reply_streams_from_the_qwen_voice_and_repeats_from_the_cache() {
    let Some(rig) = speaking_rig("loli") else {
        return;
    };
    let (first, played) = reply(&rig, "Ставлю на паузу, а потом продолжу с того же места.");
    let (again, exact) = reply(&rig, "Ставлю на паузу, а потом продолжу с того же места.");
    let seconds = exact as f32 / 24000.0;
    let gaps = (played as f32 - exact as f32) / 24000.0;
    eprintln!("first reply: sound after {first:?}, {seconds:.2} s long, {gaps:.2} s of gaps");
    eprintln!("same reply again: sound after {again:?}");
    assert!((1.5..12.0).contains(&seconds), "{seconds}");
    assert!((-0.05..0.3).contains(&gaps), "{gaps}");
    assert!(again < Duration::from_millis(300), "{again:?}");
    assert_eq!(kept(&rig), 1, "a command reply is kept for next time");
}

#[test]
fn a_reply_in_digits_and_the_same_one_in_words_are_one_phrase_for_the_qwen_voice() {
    let Some(rig) = speaking_rig("loli") else {
        return;
    };
    let (first, written) = reply(&rig, "Громкость 50%, включаю что-нибудь…");
    let said = "Громкость пятьдесят процентов, включаю что нибудь.";
    let (again, plain) = reply(&rig, said);
    eprintln!("written with digits: sound after {first:?}, in words: sound after {again:?}");
    assert!(again < Duration::from_millis(300), "{again:?}");
    assert!(
        plain <= written,
        "{plain} samples from the cache, {written} when streamed"
    );
    assert_eq!(kept(&rig), 1, "both are kept as one phrase");
}

fn asked(rig: &Rig) -> String {
    rig.engine.send(Command::Text {
        text: "как твои дела".into(),
        source: Source::Button,
        id: None,
    });
    rig.expect_state(State::Thinking);
    let command = rig.command();
    assert_eq!(command.intent, "none");
    command.id
}

fn wait_for(rig: &Rig, state: State) {
    match rig.quiet_for(PATIENCE) {
        Some(Event::State(now)) => assert_eq!(now.state, state),
        other => panic!("expected {state:?}, got {other:?}"),
    }
}

fn tell(rig: &Rig, text: &str, piece: usize, every: Duration) -> Told {
    let id = asked(rig);
    rig.heard.clear();
    let chars: Vec<char> = text.chars().collect();
    let pieces: Vec<String> = chars.chunks(piece).map(|p| p.iter().collect()).collect();
    let engine = rig.engine.clone();
    let started = Instant::now();
    let feeder = std::thread::spawn(move || {
        let chat = |step| {
            let id = id.clone();
            engine.send(Command::Chat { id, step });
        };
        chat(Chat::Open { speak: true });
        for piece in pieces {
            chat(Chat::Text(piece));
            std::thread::sleep(every);
        }
        chat(Chat::Close);
        let outcome = Outcome::default();
        engine.send(Command::Done { id, outcome });
    });
    wait_for(rig, State::Speaking);
    let first_sound = started.elapsed();
    wait_for(rig, State::Idle);
    let whole = started.elapsed();
    feeder.join().unwrap();
    Told {
        first_sound,
        whole,
        heard: rig.heard.samples(),
    }
}

fn played(rig: &Rig, seconds: f32) -> f32 {
    let until = Instant::now() + PATIENCE;
    loop {
        let played = rig.heard.samples().len() as f32 / RATE;
        if played >= seconds {
            return played;
        }
        assert!(Instant::now() < until, "only {played} s were played");
        std::thread::sleep(Duration::from_millis(10));
    }
}

fn cut_short(rig: &Rig) -> (Duration, f32) {
    let id = asked(rig);
    rig.heard.clear();
    rig.chat(&id, Chat::Open { speak: true });
    rig.chat(&id, Chat::Text(CUT.into()));
    rig.chat(&id, Chat::Close);
    wait_for(rig, State::Speaking);
    let before = played(rig, 1.0);
    let cut = Instant::now();
    rig.engine.send(Command::Cancel);
    assert_eq!(rig.cancelled(), id);
    rig.expect_state(State::Idle);
    let stopped = cut.elapsed();
    (stopped, played(rig, 0.0) - before)
}

fn runs(samples: &[f32], least: f32, quiet: impl Fn(f32) -> bool) -> Vec<(f32, f32)> {
    let mut found = Vec::new();
    let mut from = None;
    for (at, sample) in samples.iter().chain(&[1.0]).enumerate() {
        match (quiet(*sample), from) {
            (true, None) => from = Some(at),
            (false, Some(start)) => {
                let length = (at - start) as f32 / RATE;
                if length >= least && start > 0 && at < samples.len() {
                    found.push((start as f32 / RATE, length));
                }
                from = None;
            }
            _ => {}
        }
    }
    found
}

fn report(name: &str, told: &Told) -> f32 {
    let seconds = told.heard.len() as f32 / RATE;
    let starved = runs(&told.heard, 0.03, |sample| sample == 0.0);
    let pauses = runs(&told.heard, 0.15, |sample| sample.abs() < 0.02);
    let lost: f32 = starved.iter().map(|(_, length)| length).sum();
    eprintln!(
        "{name}: first sound after {:.2} s, done after {:.2} s, {seconds:.2} s played",
        told.first_sound.as_secs_f32(),
        told.whole.as_secs_f32(),
    );
    eprintln!(
        "  waited for speech {lost:.2} s in {} gaps: {starved:.2?}",
        starved.len()
    );
    eprintln!("  pauses in the speech: {pauses:.2?}");
    lost
}

fn kept(rig: &Rig) -> usize {
    std::fs::read_dir(&rig.phrases).map_or(0, |files| files.count())
}

#[test]
fn a_streamed_reply_from_the_qwen_voice_starts_early_keeps_going_and_stops_on_cancel() {
    let Some(rig) = speaking_rig("loli") else {
        return;
    };
    let cold = tell(&rig, "Раз, два, три.", 99, Duration::ZERO);
    report("first phrase after the start", &cold);
    let once = tell(&rig, ONCE, ONCE.len(), Duration::ZERO);
    report("all text at once", &once);
    let slowly = tell(&rig, SLOWLY, PIECE, EVERY);
    report("15 characters every 150 ms", &slowly);
    let (stopped, late) = cut_short(&rig);
    eprintln!("cancel after 1 s of speech: idle after {stopped:?}, {late:.2} s more were played");
    let next = tell(&rig, NEXT, NEXT.len(), Duration::ZERO);
    report("the reply after the cancelled one", &next);

    for told in [&once, &slowly, &next] {
        let first = told.first_sound;
        assert!(first < Duration::from_secs(8), "{first:?}");
    }
    for told in [&once, &slowly] {
        let seconds = told.heard.len() as f32 / RATE;
        assert!((8.0..40.0).contains(&seconds), "{seconds}");
    }
    assert!(stopped < Duration::from_secs(1), "{stopped:?}");
    assert!(late < 0.3, "{late}");
    assert_eq!(kept(&rig), 0, "chat lines are not kept for next time");
}

#[test]
fn a_streamed_reply_from_a_kokoro_voice_goes_clip_by_clip() {
    let Some(store) = kokoro_store() else {
        eprintln!("SCD_KOKORO is not set, skipped");
        return;
    };
    let rig = rig_with_voice(store, "af_heart");
    let cold = tell(&rig, "Раз, два, три.", 99, Duration::ZERO);
    report("first phrase after the start", &cold);
    let once = tell(&rig, ONCE, ONCE.len(), Duration::ZERO);
    report("all text at once", &once);
    let slowly = tell(&rig, SLOWLY, PIECE, EVERY);
    report("15 characters every 150 ms", &slowly);
    for told in [&once, &slowly] {
        let seconds = told.heard.len() as f32 / RATE;
        assert!((8.0..60.0).contains(&seconds), "{seconds}");
    }
}
