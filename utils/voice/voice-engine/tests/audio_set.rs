mod common;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use common::{Clips, Rig, in_real_time, rig_with};
use voice_engine::{
    Command, CommandEvent, Config, DecisionEvent, Event, Language, Source, State, Timing,
};
use voice_resolve::FixtureCatalog;

const CATALOG: &str = include_str!("audio-set/catalog.tsv");
const RATE: usize = 16_000;
const LEAD: usize = RATE / 2;
const TAIL: usize = RATE * 14;
const LISTENERS: usize = 8;
const RELEASED_AFTER: Duration = Duration::from_millis(300);
const LOUDEST: f32 = 0.9;
const QUIET_ROOM: (&str, f32) = ("pink", 40.0);
const AROUND: [(&str, f32); 7] = [
    QUIET_ROOM,
    ("pink", 15.0),
    ("pink", 5.0),
    ("babble", 10.0),
    ("babble", 5.0),
    ("music", 10.0),
    ("music", 0.0),
];
const PATIENCE: Duration = Duration::from_secs(40);

struct Said {
    file: String,
    language: Language,
    text: String,
}

struct Run {
    around: String,
    passed: bool,
    waited: Duration,
}

struct Set {
    folder: PathBuf,
    models: PathBuf,
    rows: Vec<Said>,
    noises: BTreeMap<&'static str, Vec<f32>>,
}

struct Understood {
    steps: Vec<String>,
    heard: String,
}

impl Understood {
    fn nothing_to_do(&self) -> bool {
        self.steps.iter().all(|step| step.starts_with("none"))
    }

    fn shown(&self) -> String {
        match self.steps.as_slice() {
            [] => "nothing".into(),
            steps => steps.join(" + "),
        }
    }
}

fn step(command: &CommandEvent) -> String {
    let number = command.number.map_or(String::new(), |n| format!(" {n}"));
    let pick = match &command.decision {
        Some(DecisionEvent::Act { pick }) => format!(" {}", pick.entity.name),
        Some(DecisionEvent::Ask { first, .. }) => format!(" asks about {}", first.entity.name),
        Some(DecisionEvent::NotFound) => " not found".into(),
        None => String::new(),
    };
    format!("{}{number}{pick}", command.intent)
}

fn folder(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).map(PathBuf::from)
}

fn clip(path: &Path) -> Vec<f32> {
    let (samples, rate) = voice_speech::read_mono(path).unwrap();
    voice_speech::to_16k(&samples, rate).unwrap()
}

fn said(set: &Path) -> Vec<Said> {
    std::fs::read_to_string(set.join("list.tsv"))
        .unwrap()
        .lines()
        .map(|line| {
            let mut cells = line.split('\t');
            let file = cells.next().unwrap().to_string();
            let language = match cells.next().unwrap() {
                "ru" => Language::Ru,
                _ => Language::En,
            };
            Said {
                file,
                language,
                text: cells.next().unwrap().to_string(),
            }
        })
        .collect()
}

fn rms(samples: &[f32]) -> f32 {
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt()
}

fn among(speech: &[f32], noise: &[f32], snr: f32, at: usize) -> Vec<f32> {
    let level = rms(speech) / rms(noise).max(f32::EPSILON) / 10f32.powf(snr / 20.0);
    let mut mix: Vec<f32> = (0..LEAD + speech.len() + TAIL)
        .map(|i| {
            let voice = i
                .checked_sub(LEAD)
                .and_then(|i| speech.get(i))
                .copied()
                .unwrap_or(0.0);
            voice + level * noise[(at + i) % noise.len()]
        })
        .collect();
    let peak = mix.iter().fold(0.0f32, |peak, s| peak.max(s.abs()));
    if peak > LOUDEST {
        mix.iter_mut().for_each(|s| *s *= LOUDEST / peak);
    }
    mix
}

fn understood(rig: &Rig) -> Understood {
    let mut all = Understood {
        steps: Vec::new(),
        heard: String::new(),
    };
    let mut busy = false;
    loop {
        match rig.events.recv_timeout(PATIENCE) {
            Ok(Event::Command(command)) => {
                rig.done(&command.id, "");
                all.steps.push(step(&command));
                all.heard = command.heard.clone();
                busy = true;
            }
            Ok(Event::Error(error)) => {
                all.steps.push(error.code.into());
                busy = true;
            }
            Ok(Event::State(s)) if s.state == State::Idle && busy => return all,
            Ok(Event::State(_)) => busy = true,
            Ok(_) => {}
            Err(_) => {
                all.steps.push("no answer".into());
                return all;
            }
        }
    }
}

fn listener(set: &Set, language: Language, code: &str, next: &AtomicUsize) -> Vec<Run> {
    let clips = Clips::default();
    let rig = rig_with(
        in_real_time(clips.clone()),
        Arc::new(FixtureCatalog::from_tsv(CATALOG, true)),
        set.models.clone(),
        Timing::default(),
    );
    let mut config = Config {
        enabled: true,
        language,
        ..Config::default()
    };
    config.speak.replies = false;
    rig.engine.send(Command::Apply(Box::new(config)));
    let mut runs = Vec::new();
    loop {
        let at = next.fetch_add(1, Ordering::Relaxed);
        let Some(row) = set.rows.get(at) else {
            return runs;
        };
        if row.language != language {
            continue;
        }
        rig.engine.send(Command::Text {
            text: row.text.clone(),
            source: Source::Button,
            id: None,
        });
        let typed = understood(&rig);
        if typed.nothing_to_do() {
            eprintln!("{code} not a command when typed: {}", row.text);
            continue;
        }
        let speech = clip(&set.folder.join(&row.file));
        let said_for = Duration::from_secs_f32((LEAD + speech.len()) as f32 / RATE as f32);
        let around = AROUND
            .iter()
            .filter_map(|(name, snr)| Some((name, snr, set.noises.get(name)?)));
        for ((name, snr, noise), held) in around.flat_map(|noise| [(noise, true), (noise, false)]) {
            let around = format!("{} | {name} {snr} dB", if held { "held" } else { "tapped" });
            clips
                .lock()
                .unwrap()
                .push_back(among(&speech, noise, *snr, at * RATE * 3));
            let started = Instant::now();
            if held {
                rig.engine.send(Command::Start(Source::Hotkey));
                std::thread::sleep(said_for + RELEASED_AFTER);
                rig.engine.send(Command::Release(Source::Hotkey));
            } else {
                rig.engine.send(Command::Start(Source::Button));
            }
            let heard = understood(&rig);
            let waited = started.elapsed().saturating_sub(said_for);
            let passed = heard.steps == typed.steps;
            if !passed {
                eprintln!(
                    "{code} {around} | {} | said \"{}\" | heard \"{}\" | {} -> {} | {:.1} s",
                    row.file,
                    row.text,
                    heard.heard,
                    typed.shown(),
                    heard.shown(),
                    waited.as_secs_f32()
                );
            }
            runs.push(Run {
                around: format!("{code} {around}"),
                passed,
                waited,
            });
        }
    }
}

#[test]
fn spoken_commands_from_the_audio_set_are_understood() {
    let (Some(folder), Some(models)) = (folder("SCD_AUDIO_SET"), folder("SCD_VOICE_STORE")) else {
        eprintln!("SCD_AUDIO_SET and SCD_VOICE_STORE are not set, skipped");
        return;
    };
    let noises = AROUND
        .iter()
        .map(|(name, _)| *name)
        .filter(|name| folder.join(format!("noise/{name}.wav")).exists())
        .map(|name| (name, clip(&folder.join(format!("noise/{name}.wav")))))
        .collect();
    let set = Set {
        rows: said(&folder),
        folder,
        models,
        noises,
    };
    let mut runs = Vec::new();
    for (language, code) in [(Language::Ru, "ru"), (Language::En, "en")] {
        let next = AtomicUsize::new(0);
        std::thread::scope(|scope| {
            let listeners: Vec<_> = (0..LISTENERS)
                .map(|_| scope.spawn(|| listener(&set, language, code, &next)))
                .collect();
            for listener in listeners {
                runs.extend(listener.join().unwrap());
            }
        });
    }
    let mut score: BTreeMap<&str, Vec<&Run>> = BTreeMap::new();
    for run in &runs {
        score.entry(&run.around).or_default().push(run);
    }
    let quiet_room = format!("held | {} {} dB", QUIET_ROOM.0, QUIET_ROOM.1);
    for (around, runs) in &mut score {
        runs.sort_by_key(|run| run.waited);
        let passed = runs.iter().filter(|run| run.passed).count();
        eprintln!(
            "{around}: {passed} of {}, answer {:.1} s after the last word, {:.1} s at most",
            runs.len(),
            runs[runs.len() / 2].waited.as_secs_f32(),
            runs[runs.len() - 1].waited.as_secs_f32()
        );
        if around.ends_with(&quiet_room) {
            assert!(passed * 4 >= runs.len() * 3, "{around}");
        }
    }
    assert!(!runs.is_empty());
}
