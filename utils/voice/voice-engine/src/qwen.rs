use std::path::PathBuf;

use voice_qwen::{Engine, Error, Launch, Request, Sink};

pub const RATE: u32 = 24000;

const FRAMES_PER_SECOND: f32 = 12.5;
const CHARS_PER_SECOND: f32 = 11.0;
const CPU: &str = "CPU";
const LANG: &str = "auto";
const SEED: i64 = 1;

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

impl Qwen {
    pub fn warm(&mut self, paths: &Paths) {
        let _ = self.engine(paths);
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

    fn start(&mut self, paths: &Paths) -> Result<Engine, String> {
        let launch = |device: Option<&str>| Launch {
            program: paths.program.clone(),
            talker: paths.talker.clone(),
            codec: paths.codec.clone(),
            device: device.map(str::to_string),
        };
        let engine = if self.cpu_only {
            Engine::start(&launch(Some(CPU)))?
        } else {
            match Engine::start(&launch(None)) {
                Ok(engine) => engine,
                Err(_) => {
                    self.cpu_only = true;
                    Engine::start(&launch(Some(CPU)))?
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

    #[test]
    fn longer_text_gets_more_room() {
        assert!(seconds("Включаю Скриптонита.") > 1.5);
        assert!(seconds("Включаю Скриптонита.") < 3.0);
        assert!(max_tokens("Да.") >= 50);
        assert!(max_tokens(&"слово ".repeat(40)) > max_tokens("Включаю Скриптонита.") * 3);
    }
}
