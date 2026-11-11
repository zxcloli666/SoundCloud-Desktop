use std::fs;
use std::path::PathBuf;
use std::time::Instant;

use voice_qwen::{Engine, Error, Launch, Request, Sink};

pub const RATE: u32 = 24000;

const FRAMES_PER_SECOND: f32 = 12.5;
const CHARS_PER_SECOND: f32 = 11.0;
const CPU: &str = "CPU";
const BEST: &str = "best";
const CHOICE: &str = "device";
const LANG: &str = "auto";
const SEED: i64 = 1;
const TRIAL: &str = "Проверяю, как быстро получается говорить на этом компьютере.";
const REAL_TIME: f32 = 1.0;

#[derive(Clone, PartialEq)]
pub struct Paths {
    pub program: PathBuf,
    pub talker: PathBuf,
    pub codec: PathBuf,
}

pub fn seconds(text: &str) -> f32 {
    0.3 + text.chars().count() as f32 / CHARS_PER_SECOND
}

fn max_tokens(text: &str) -> u32 {
    (seconds(text) * FRAMES_PER_SECOND * 2.5) as u32 + 40
}

#[derive(Default)]
pub struct Qwen {
    running: Option<(Paths, Engine)>,
    cpu_only: bool,
}

struct Counted<'a> {
    sink: &'a mut dyn Sink,
    chunks: usize,
}

impl Sink for Counted<'_> {
    fn audio(&mut self, samples: Vec<f32>) {
        self.chunks += 1;
        self.sink.audio(samples);
    }

    fn wanted(&self) -> bool {
        self.sink.wanted()
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
    fn choice(&self) -> PathBuf {
        self.program.with_file_name(CHOICE)
    }

    fn choose(&self, device: &str) {
        let _ = fs::write(self.choice(), device);
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
    pub fn warm(&mut self, paths: &Paths, speaker: &str, busy: &dyn Fn() -> bool) {
        let Ok(engine) = self.engine(paths) else {
            return;
        };
        if engine.device() == CPU || paths.choice().exists() {
            return;
        }
        let Some(best) = self.pace(paths, speaker, busy) else {
            return;
        };
        if self.cpu_only {
            return;
        }
        if best >= REAL_TIME {
            return paths.choose(BEST);
        }
        self.running = None;
        let Ok(engine) = Engine::start(&paths.launch(Some(CPU))) else {
            return paths.choose(BEST);
        };
        self.running = Some((paths.clone(), engine));
        match self.pace(paths, speaker, busy) {
            Some(cpu) if cpu > best => paths.choose(CPU),
            Some(_) => {
                paths.choose(BEST);
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
        speaker: &str,
        text: &str,
        sink: &mut dyn Sink,
    ) -> Result<(), String> {
        let request = Request {
            text,
            speaker,
            lang: LANG,
            seed: SEED,
            max_tokens: max_tokens(text),
        };
        let mut counted = Counted { sink, chunks: 0 };
        match self.engine(paths)?.say(&request, &mut counted) {
            Ok(()) => Ok(()),
            Err(Error::Refused(why)) => Err(why),
            Err(Error::Stopped(why)) => {
                self.running = None;
                if self.cpu_only || counted.chunks > 0 {
                    return Err(why);
                }
                self.cpu_only = true;
                self.engine(paths)?
                    .say(&request, &mut counted)
                    .map_err(|e| e.to_string())
            }
        }
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

    fn pace(&mut self, paths: &Paths, speaker: &str, busy: &dyn Fn() -> bool) -> Option<f32> {
        let mut timed = Timed {
            busy,
            first: None,
            last: Instant::now(),
            later: 0,
        };
        self.say(paths, speaker, TRIAL, &mut timed).ok()?;
        timed.pace()
    }

    fn start(&mut self, paths: &Paths) -> Result<Engine, String> {
        let chosen = fs::read_to_string(paths.choice()).unwrap_or_default();
        let engine = if self.cpu_only || chosen == CPU {
            Engine::start(&paths.launch(Some(CPU)))?
        } else {
            match Engine::start(&paths.launch(None)) {
                Ok(engine) => engine,
                Err(_) => {
                    self.cpu_only = true;
                    Engine::start(&paths.launch(Some(CPU)))?
                }
            }
        };
        if engine.rate() != RATE {
            return Err(format!("speech engine runs at {} Hz", engine.rate()));
        }
        Ok(engine)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn real(name: &str) -> Option<Paths> {
        let path = |name: &str| std::env::var_os(name).map(PathBuf::from);
        let (program, talker, codec) = (
            path("SCD_QWEN")?,
            path("SCD_QWEN_TALKER")?,
            path("SCD_QWEN_CODEC")?,
        );
        let dir = std::env::temp_dir().join(format!("voice-qwen-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        std::os::unix::fs::symlink(program, dir.join("scd-qwen")).unwrap();
        Some(Paths {
            program: dir.join("scd-qwen"),
            talker,
            codec,
        })
    }

    fn device(qwen: &mut Qwen, paths: &Paths) -> String {
        qwen.engine(paths).unwrap().device().to_string()
    }

    #[test]
    fn the_first_warm_up_picks_the_faster_device_and_remembers_it() {
        let Some(paths) = real("trial") else {
            eprintln!("SCD_QWEN, SCD_QWEN_TALKER, SCD_QWEN_CODEC are not set, skipped");
            return;
        };
        let mut qwen = Qwen::default();
        let best = device(&mut qwen, &paths);
        if best == CPU {
            eprintln!("no faster device than the CPU here, nothing to pick");
            return;
        }
        eprintln!("{best} pace {:?}", qwen.pace(&paths, "loli", &|| false));

        qwen.warm(&paths, "loli", &|| true);
        assert!(!paths.choice().exists(), "a trial cut short decides nothing");

        let started = Instant::now();
        qwen.warm(&paths, "loli", &|| false);
        let chosen = fs::read_to_string(paths.choice()).unwrap();
        eprintln!("chose {chosen} in {:?}", started.elapsed());
        assert!(chosen == BEST || chosen == CPU, "{chosen}");
        assert_eq!(device(&mut qwen, &paths) == CPU, chosen == CPU);

        let mut later = Qwen::default();
        assert_eq!(device(&mut later, &paths) == CPU, chosen == CPU);
        let started = Instant::now();
        later.warm(&paths, "loli", &|| false);
        assert!(started.elapsed().as_secs_f32() < 0.5, "a made choice is not tried again");
    }

    #[test]
    fn longer_text_gets_more_room() {
        assert!(seconds("Включаю Скриптонита.") > 1.5);
        assert!(seconds("Включаю Скриптонита.") < 3.0);
        assert!(max_tokens("Да.") >= 50);
        assert!(max_tokens(&"слово ".repeat(40)) > max_tokens("Включаю Скриптонита.") * 3);
    }
}
