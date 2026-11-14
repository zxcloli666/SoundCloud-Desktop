use std::path::PathBuf;
use std::time::Instant;

use crate::choice::{self, Choice};
use crate::engine::{Engine, Error, Launch, Request, Sink};

pub const RATE: u32 = 24000;
pub const CPU: &str = "CPU";

const CHOICE: &str = "device";
const REAL_TIME: f32 = 1.0;

#[derive(Clone, PartialEq)]
pub struct Paths {
    pub program: PathBuf,
    pub talker: PathBuf,
    pub codec: PathBuf,
}

#[derive(Default)]
pub struct Qwen {
    running: Option<(Paths, Engine)>,
    retried: bool,
    troubles: Vec<String>,
}

struct Once<'a> {
    sink: &'a mut dyn Sink,
    given: usize,
    skip: usize,
}

impl Sink for Once<'_> {
    fn audio(&mut self, mut samples: Vec<f32>) {
        let heard = self.skip.min(samples.len());
        self.skip -= heard;
        samples.drain(..heard);
        if !samples.is_empty() {
            self.given += samples.len();
            self.sink.audio(samples);
        }
    }

    fn wanted(&self) -> bool {
        self.sink.wanted()
    }

    fn again(&mut self) {
        self.skip = self.given;
        self.sink.again();
    }
}

struct Timed<'a> {
    busy: &'a dyn Fn() -> bool,
    first: Option<Instant>,
    last: Instant,
    later: usize,
}

impl Sink for Timed<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.last = Instant::now();
        match self.first {
            Some(_) => self.later += samples.len(),
            None => self.first = Some(self.last),
        }
    }

    fn wanted(&self) -> bool {
        !(self.busy)()
    }
}

impl Timed<'_> {
    fn pace(&self) -> Option<f32> {
        let took = self.last.duration_since(self.first?).as_secs_f32();
        (self.wanted() && took > 0.0).then(|| self.later as f32 / RATE as f32 / took)
    }
}

impl Paths {
    pub fn choice(&self) -> PathBuf {
        self.program.with_file_name(CHOICE)
    }

    fn chosen(&self) -> Choice {
        Choice::kept(&self.choice())
    }

    fn choose(&self, choice: Choice) {
        choice.keep(&self.choice());
    }

    fn launch(&self, device: Option<&str>) -> Launch {
        Launch {
            program: self.program.clone(),
            talker: self.talker.clone(),
            codec: self.codec.clone(),
            device: device.map(str::to_string),
        }
    }
}

impl Qwen {
    pub fn warm(&mut self, paths: &Paths, trial: &Request, busy: &dyn Fn() -> bool) {
        let Ok(device) = self.device(paths) else {
            return;
        };
        if device == CPU || paths.chosen().settled() {
            return;
        }
        let Some(best) = self.pace(paths, trial, busy) else {
            return;
        };
        if self.runs_on() != Some(device.as_str()) {
            return;
        }
        if best >= REAL_TIME {
            return paths.choose(Choice::Best);
        }
        self.running = None;
        let Ok(engine) = Engine::start(&paths.launch(Some(CPU))) else {
            return paths.choose(Choice::Best);
        };
        self.running = Some((paths.clone(), engine));
        match self.pace(paths, trial, busy) {
            Some(cpu) if cpu > best => paths.choose(Choice::Cpu),
            Some(_) => {
                paths.choose(Choice::Best);
                self.running = None;
                let _ = self.engine(paths);
            }
            None => {}
        }
    }

    pub fn rest(&mut self) {
        self.running = None;
    }

    pub fn say(
        &mut self,
        paths: &Paths,
        request: &Request,
        sink: &mut dyn Sink,
    ) -> Result<(), String> {
        let mut once = Once {
            sink,
            given: 0,
            skip: 0,
        };
        let device = self.device(paths)?;
        let why = match self.speak(paths, request, &mut once) {
            Err(Error::Stopped(why)) if device != CPU => why,
            spoken => {
                if spoken.is_ok() && once.given > 0 {
                    self.trusted(paths);
                }
                return spoken.map_err(|e| e.to_string());
            }
        };
        once.again();
        let engine = self.cpu_instead(paths, &device, &why)?;
        self.running = Some((paths.clone(), engine));
        self.speak(paths, request, &mut once)
            .map_err(|e| e.to_string())
    }

    pub fn device(&mut self, paths: &Paths) -> Result<String, String> {
        Ok(self.engine(paths)?.device().to_string())
    }

    pub fn troubles(&mut self) -> Vec<String> {
        std::mem::take(&mut self.troubles)
    }

    fn engine(&mut self, paths: &Paths) -> Result<&mut Engine, String> {
        if self.running.as_ref().is_some_and(|(at, _)| at != paths) {
            self.running = None;
        }
        if self.running.is_none() {
            let engine = self.start(paths)?;
            self.running = Some((paths.clone(), engine));
        }
        match self.running.as_mut() {
            Some((_, engine)) => Ok(engine),
            None => Err("speech engine is not running".into()),
        }
    }

    fn runs_on(&self) -> Option<&str> {
        self.running.as_ref().map(|(_, engine)| engine.device())
    }

    fn pace(&mut self, paths: &Paths, trial: &Request, busy: &dyn Fn() -> bool) -> Option<f32> {
        let mut timed = Timed {
            busy,
            first: None,
            last: Instant::now(),
            later: 0,
        };
        self.say(paths, trial, &mut timed).ok()?;
        timed.pace()
    }

    fn speak(
        &mut self,
        paths: &Paths,
        request: &Request,
        sink: &mut dyn Sink,
    ) -> Result<(), Error> {
        let engine = self.engine(paths).map_err(Error::Stopped)?;
        let spoken = engine.say(request, sink);
        if matches!(spoken, Err(Error::Stopped(_))) {
            self.running = None;
        }
        spoken
    }

    fn start(&mut self, paths: &Paths) -> Result<Engine, String> {
        let chosen = paths.chosen();
        if chosen.on_cpu(choice::now()) {
            self.retried = false;
            return on_cpu(paths);
        }
        self.retried = matches!(chosen, Choice::Stopped { .. });
        match Engine::start(&paths.launch(None)).and_then(at_rate) {
            Ok(engine) => Ok(engine),
            Err(why) => self.cpu_instead(paths, "the default device", &why),
        }
    }

    fn cpu_instead(&mut self, paths: &Paths, device: &str, why: &str) -> Result<Engine, String> {
        self.retried = false;
        let engine =
            on_cpu(paths).map_err(|cpu| format!("{cpu}\nafter {device} stopped: {why}"))?;
        let choice = paths.chosen().stopped(choice::now());
        paths.choose(choice);
        let lasts = choice.lasts();
        self.troubles.push(format!(
            "speech engine left {device} for the CPU {lasts}: {why}"
        ));
        Ok(engine)
    }

    fn trusted(&mut self, paths: &Paths) {
        if std::mem::take(&mut self.retried) {
            paths.choose(Choice::Open);
        }
    }
}

fn on_cpu(paths: &Paths) -> Result<Engine, String> {
    Engine::start(&paths.launch(Some(CPU))).and_then(at_rate)
}

fn at_rate(engine: Engine) -> Result<Engine, String> {
    if engine.rate() != RATE {
        return Err(format!("speech engine runs at {} Hz", engine.rate()));
    }
    Ok(engine)
}
