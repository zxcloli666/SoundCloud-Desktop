use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use voice_qwen::{CPU, Paths, Qwen, Request, Sink};

const PHRASE: usize = 12000;
const DEVICE: f32 = 0.5;
const PROCESSOR: f32 = 0.25;
const HOUR: u64 = 60 * 60;
const DAY: u64 = 24 * HOUR;
const HEALTHY: &str = "FAKE0 speaks\nCPU speaks";
const BROKEN: &str = "FAKE0 dies\nCPU speaks";

#[derive(Default)]
struct Heard {
    samples: Vec<f32>,
    again: usize,
    stop_at_once: bool,
}

impl Sink for Heard {
    fn audio(&mut self, samples: Vec<f32>) {
        self.samples.extend(samples);
    }

    fn wanted(&self) -> bool {
        !self.stop_at_once
    }

    fn again(&mut self) {
        self.again += 1;
    }
}

fn machine(name: &str, plan: &str) -> Paths {
    let dir = std::env::temp_dir().join(format!("voice-qwen-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let built = PathBuf::from(env!("CARGO_BIN_EXE_fake-qwen"));
    let program = dir.join(built.file_name().unwrap());
    fs::copy(built, &program).unwrap();
    fs::write(dir.join("plan"), plan).unwrap();
    Paths {
        program,
        talker: dir.join("plan"),
        codec: dir.join("plan"),
    }
}

fn phrase() -> Request<'static> {
    Request {
        text: "Включаю.",
        speaker: "loli",
        lang: "auto",
        seed: 1,
        max_tokens: 100,
    }
}

fn heard(qwen: &mut Qwen, paths: &Paths) -> Result<Heard, String> {
    let mut heard = Heard::default();
    qwen.say(paths, &phrase(), &mut heard)?;
    Ok(heard)
}

fn said(qwen: &mut Qwen, paths: &Paths) -> Result<Vec<f32>, String> {
    Ok(heard(qwen, paths)?.samples)
}

fn chosen(paths: &Paths) -> Option<String> {
    fs::read_to_string(paths.choice()).ok()
}

fn now() -> u64 {
    let since = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    since.as_secs()
}

fn stops(paths: &Paths) -> Option<(usize, u64)> {
    let chosen = chosen(paths)?;
    let mut words = chosen.split(' ');
    assert_eq!(words.next(), Some(CPU), "{chosen}");
    let times = words.next()?.parse().unwrap();
    let ago = now() - words.next()?.parse::<u64>().unwrap();
    Some((times, ago))
}

fn stopped(paths: &Paths, times: usize) -> bool {
    stops(paths).is_some_and(|(stops, ago)| stops == times && ago < HOUR)
}

fn remembered(name: &str, plan: &str, choice: String) -> Paths {
    let paths = machine(name, plan);
    fs::write(paths.choice(), choice).unwrap();
    paths
}

fn plan(paths: &Paths, plan: &str) {
    fs::write(&paths.talker, plan).unwrap();
}

#[test]
fn a_device_that_dies_while_speaking_gives_way_to_the_cpu_and_the_phrase_is_spoken_once() {
    let paths = machine("dies", BROKEN);
    let mut qwen = Qwen::default();
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    let first = heard(&mut qwen, &paths).unwrap();
    assert_eq!(first.samples, vec![PROCESSOR; PHRASE]);
    assert_eq!(first.again, 1);
    assert_eq!(qwen.device(&paths).unwrap(), CPU);
    assert!(stopped(&paths, 1), "{:?}", chosen(&paths));
    let troubles = qwen.troubles();
    assert_eq!(troubles.len(), 1, "{troubles:?}");
    assert!(troubles[0].contains("left FAKE0 for the CPU for 24 h"));
    assert!(troubles[0].contains("the device was lost"), "{troubles:?}");
    assert!(troubles[0].contains("thread_start"), "{troubles:?}");

    let second = heard(&mut qwen, &paths).unwrap();
    assert_eq!(second.samples, vec![PROCESSOR; PHRASE]);
    assert_eq!(second.again, 0);
    assert!(qwen.troubles().is_empty());
    let mut later = Qwen::default();
    assert_eq!(later.device(&paths).unwrap(), CPU);
    assert!(later.troubles().is_empty());
}

#[test]
fn speech_cut_in_the_middle_goes_on_from_the_same_place() {
    let paths = machine("late", "FAKE0 dies-late\nCPU speaks");
    let heard = said(&mut Qwen::default(), &paths).unwrap();
    let begun = PHRASE * 2 / 5;
    assert_eq!(heard.len(), PHRASE);
    assert_eq!(heard[..begun], vec![DEVICE; begun]);
    assert_eq!(heard[begun..], vec![PROCESSOR; PHRASE - begun]);
    assert!(stopped(&paths, 1));
}

#[test]
fn a_device_that_does_not_start_gives_way_to_the_cpu() {
    let paths = machine("absent", "FAKE0 absent\nCPU speaks");
    let mut qwen = Qwen::default();
    assert_eq!(said(&mut qwen, &paths).unwrap(), vec![PROCESSOR; PHRASE]);
    assert!(stopped(&paths, 1));
    let troubles = qwen.troubles();
    assert!(troubles[0].contains("the device was lost"), "{troubles:?}");
}

#[test]
fn a_device_that_hangs_is_stopped_and_gives_way_to_the_cpu() {
    let paths = machine("stalls", "FAKE0 stalls\nCPU speaks");
    let mut qwen = Qwen::default();
    let started = Instant::now();
    let heard = heard(&mut qwen, &paths).unwrap();
    assert!(started.elapsed() < Duration::from_secs(60));
    assert_eq!(heard.samples, vec![PROCESSOR; PHRASE]);
    assert_eq!(heard.again, 1);
    assert!(stopped(&paths, 1));
}

#[test]
fn a_healthy_device_keeps_speaking_and_nothing_is_chosen() {
    let paths = machine("healthy", HEALTHY);
    let mut qwen = Qwen::default();
    assert_eq!(said(&mut qwen, &paths).unwrap(), vec![DEVICE; PHRASE]);
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    assert_eq!(chosen(&paths), None);
    assert!(qwen.troubles().is_empty());
}

#[test]
fn a_cpu_that_dies_is_a_failure() {
    let paths = machine("cpu", "CPU dies");
    let mut qwen = Qwen::default();
    let error = said(&mut qwen, &paths).unwrap_err();
    assert!(error.contains("the device was lost"), "{error}");
    assert_eq!(chosen(&paths), None);
    assert!(qwen.troubles().is_empty());

    let paths = machine("both", "FAKE0 dies\nCPU dies");
    let error = said(&mut Qwen::default(), &paths).unwrap_err();
    assert!(error.contains("the device was lost"), "{error}");
}

#[test]
fn a_crash_in_the_first_trial_chooses_the_cpu() {
    let paths = machine("trial", BROKEN);
    let mut qwen = Qwen::default();
    qwen.warm(&paths, &phrase(), &|| false);
    assert!(stopped(&paths, 1));
    assert_eq!(qwen.device(&paths).unwrap(), CPU);
    assert_eq!(qwen.troubles().len(), 1);
}

#[test]
fn the_first_trial_keeps_a_fast_device_and_leaves_a_slow_one() {
    let fast = machine("fast", HEALTHY);
    let mut qwen = Qwen::default();
    qwen.warm(&fast, &phrase(), &|| true);
    assert_eq!(chosen(&fast), None, "a trial cut short decides nothing");
    qwen.warm(&fast, &phrase(), &|| false);
    assert_eq!(chosen(&fast).as_deref(), Some("best"));
    assert_eq!(qwen.device(&fast).unwrap(), "FAKE0");

    let slow = machine("slow", "FAKE0 slow\nCPU speaks");
    let mut qwen = Qwen::default();
    qwen.warm(&slow, &phrase(), &|| false);
    assert_eq!(chosen(&slow).as_deref(), Some(CPU));
    assert_eq!(qwen.device(&slow).unwrap(), CPU);
    assert!(qwen.troubles().is_empty());
}

#[test]
fn a_stopped_device_is_left_alone_until_its_pause_has_passed() {
    let day = format!("{CPU} 1 {}", now() - DAY + HOUR);
    let three = format!("{CPU} 2 {}", now() - 3 * DAY + HOUR);
    for (name, choice) in [("day", day), ("three", three)] {
        let paths = remembered(name, HEALTHY, choice.clone());
        let mut qwen = Qwen::default();
        assert_eq!(qwen.device(&paths).unwrap(), CPU);
        qwen.warm(&paths, &phrase(), &|| false);
        assert_eq!(said(&mut qwen, &paths).unwrap(), vec![PROCESSOR; PHRASE]);
        assert_eq!(chosen(&paths), Some(choice));
        assert!(qwen.troubles().is_empty());
    }
}

#[test]
fn a_stopped_device_is_tried_again_after_its_pause_and_a_new_stop_waits_longer() {
    let paths = remembered("again", BROKEN, format!("{CPU} 1 {}", now() - DAY - HOUR));
    let mut qwen = Qwen::default();
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    let heard = heard(&mut qwen, &paths).unwrap();
    assert_eq!(heard.samples, vec![PROCESSOR; PHRASE]);
    assert_eq!(heard.again, 1);
    assert!(stopped(&paths, 2), "{:?}", chosen(&paths));
    let troubles = qwen.troubles();
    assert!(troubles[0].contains("left FAKE0 for the CPU for 72 h"));
    assert_eq!(Qwen::default().device(&paths).unwrap(), CPU);
}

#[test]
fn the_third_stop_in_a_row_leaves_the_device_for_good() {
    let paths = remembered(
        "third",
        BROKEN,
        format!("{CPU} 2 {}", now() - 3 * DAY - HOUR),
    );
    let mut qwen = Qwen::default();
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    assert_eq!(said(&mut qwen, &paths).unwrap(), vec![PROCESSOR; PHRASE]);
    assert_eq!(chosen(&paths).as_deref(), Some(CPU));
    let troubles = qwen.troubles();
    assert!(troubles[0].contains("left FAKE0 for the CPU for good"));

    plan(&paths, HEALTHY);
    let mut later = Qwen::default();
    assert_eq!(later.device(&paths).unwrap(), CPU);
    later.warm(&paths, &phrase(), &|| false);
    assert_eq!(chosen(&paths).as_deref(), Some(CPU));
}

#[test]
fn a_device_that_speaks_after_its_pause_starts_with_a_clean_record() {
    let record = format!("{CPU} 2 {}", now() - 3 * DAY - HOUR);
    let paths = remembered("clean", HEALTHY, record.clone());
    let mut qwen = Qwen::default();
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    let mut unwanted = Heard {
        stop_at_once: true,
        ..Heard::default()
    };
    qwen.say(&paths, &phrase(), &mut unwanted).unwrap();
    assert_eq!(chosen(&paths), Some(record), "no sound proves nothing");
    assert_eq!(said(&mut qwen, &paths).unwrap(), vec![DEVICE; PHRASE]);
    assert_eq!(chosen(&paths), None);
    assert_eq!(qwen.device(&paths).unwrap(), "FAKE0");
    assert!(qwen.troubles().is_empty());

    qwen.rest();
    plan(&paths, BROKEN);
    assert_eq!(said(&mut qwen, &paths).unwrap(), vec![PROCESSOR; PHRASE]);
    assert!(stopped(&paths, 1), "{:?}", chosen(&paths));
}

#[test]
fn the_warm_up_tries_a_stopped_device_again_and_measures_it_anew() {
    let due = || format!("{CPU} 1 {}", now() - DAY - HOUR);
    let healed = remembered("healed", HEALTHY, due());
    let mut qwen = Qwen::default();
    qwen.warm(&healed, &phrase(), &|| false);
    assert_eq!(chosen(&healed).as_deref(), Some("best"));
    assert_eq!(qwen.device(&healed).unwrap(), "FAKE0");

    let broken = remembered("unhealed", BROKEN, due());
    let mut qwen = Qwen::default();
    qwen.warm(&broken, &phrase(), &|| false);
    assert!(stopped(&broken, 2), "{:?}", chosen(&broken));
    assert_eq!(qwen.device(&broken).unwrap(), CPU);
    assert_eq!(said(&mut qwen, &broken).unwrap(), vec![PROCESSOR; PHRASE]);
}

#[test]
fn choices_written_before_stops_were_counted_keep_their_meaning() {
    let cpu = remembered("old-cpu", HEALTHY, CPU.to_string());
    let mut qwen = Qwen::default();
    assert_eq!(qwen.device(&cpu).unwrap(), CPU);
    qwen.warm(&cpu, &phrase(), &|| false);
    assert_eq!(said(&mut qwen, &cpu).unwrap(), vec![PROCESSOR; PHRASE]);
    assert_eq!(chosen(&cpu).as_deref(), Some(CPU));

    let best = remembered("old-best", "FAKE0 slow\nCPU speaks", "best".to_string());
    let mut qwen = Qwen::default();
    qwen.warm(&best, &phrase(), &|| false);
    assert_eq!(qwen.device(&best).unwrap(), "FAKE0");
    assert_eq!(said(&mut qwen, &best).unwrap(), vec![DEVICE; PHRASE]);
    assert_eq!(chosen(&best).as_deref(), Some("best"));
}
