use std::collections::VecDeque;
use std::fmt;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::wire::{self, Frame};

const READY: Duration = Duration::from_secs(120);
const STALL: Duration = Duration::from_secs(20);
const POLL: Duration = Duration::from_millis(40);
const EXIT: Duration = Duration::from_secs(2);
const LOG_LINES: usize = 20;

pub struct Launch {
    pub program: PathBuf,
    pub talker: PathBuf,
    pub codec: PathBuf,
    pub device: Option<String>,
}

pub struct Request<'a> {
    pub text: &'a str,
    pub speaker: &'a str,
    pub lang: &'a str,
    pub seed: i64,
    pub max_tokens: u32,
}

pub trait Sink {
    fn audio(&mut self, samples: Vec<f32>);
    fn wanted(&self) -> bool;
}

#[derive(Debug)]
pub enum Error {
    Stopped(String),
    Refused(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Stopped(why) => write!(f, "speech engine stopped: {why}"),
            Error::Refused(why) => write!(f, "speech engine refused: {why}"),
        }
    }
}

type Log = Arc<Mutex<VecDeque<String>>>;

pub struct Engine {
    child: Child,
    stdin: Option<ChildStdin>,
    frames: Receiver<Frame>,
    log: Log,
    rate: u32,
    device: String,
    last: u32,
}

impl Engine {
    pub fn start(launch: &Launch) -> Result<Engine, String> {
        let mut command = Command::new(&launch.program);
        command.arg(&launch.talker).arg(&launch.codec);
        if let Some(device) = &launch.device {
            command.arg(device);
        }
        if let Some(dir) = launch.program.parent() {
            command.current_dir(dir);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hide_window(&mut command);
        let mut child = command
            .spawn()
            .map_err(|e| format!("speech engine did not start: {e}"))?;
        let stdin = child.stdin.take();
        let frames = read_frames(&mut child);
        let log = read_log(&mut child);
        let mut engine = Engine {
            child,
            stdin,
            frames,
            log,
            rate: 0,
            device: String::new(),
            last: 0,
        };
        match engine.frames.recv_timeout(READY) {
            Ok(frame) if frame.kind == wire::READY => {
                let greeting = String::from_utf8_lossy(&frame.payload);
                let (rate, device) = greeting
                    .split_once('\n')
                    .ok_or("speech engine sent a bad greeting")?;
                engine.rate = rate
                    .parse()
                    .map_err(|_| "speech engine sent a bad greeting".to_string())?;
                engine.device = device.to_string();
                Ok(engine)
            }
            Ok(frame) if frame.kind == wire::FAILED => Err(engine.detail(&frame.payload)),
            _ => Err(engine.detail(&[])),
        }
    }

    pub fn rate(&self) -> u32 {
        self.rate
    }

    pub fn device(&self) -> &str {
        &self.device
    }

    pub fn say(&mut self, request: &Request, sink: &mut dyn Sink) -> Result<(), Error> {
        self.last += 1;
        let id = self.last;
        let payload = format!(
            "{}\n{}\n{}\n{}\n{}",
            request.seed, request.max_tokens, request.speaker, request.lang, request.text
        );
        self.send(wire::SAY, id, payload.as_bytes())?;
        let mut cancelled = false;
        let mut heard = Instant::now();
        loop {
            if !cancelled && !sink.wanted() {
                self.send(wire::CANCEL, id, &[])?;
                cancelled = true;
            }
            let frame = match self.frames.recv_timeout(POLL) {
                Ok(frame) => frame,
                Err(RecvTimeoutError::Timeout) if heard.elapsed() < STALL => continue,
                Err(_) => return Err(self.stopped()),
            };
            heard = Instant::now();
            if frame.id != id {
                continue;
            }
            match frame.kind {
                wire::AUDIO if !cancelled => sink.audio(wire::samples(&frame.payload)),
                wire::DONE => return Ok(()),
                wire::FAILED => return Err(Error::Refused(self.detail(&frame.payload))),
                _ => {}
            }
        }
    }

    fn send(&mut self, kind: u8, id: u32, payload: &[u8]) -> Result<(), Error> {
        let sent = match self.stdin.as_mut() {
            Some(stdin) => wire::write(stdin, kind, id, payload).is_ok(),
            None => false,
        };
        if sent { Ok(()) } else { Err(self.stopped()) }
    }

    fn stopped(&mut self) -> Error {
        self.stdin = None;
        let _ = self.child.kill();
        let _ = self.child.wait();
        Error::Stopped(self.detail(&[]))
    }

    fn detail(&self, payload: &[u8]) -> String {
        let said = String::from_utf8_lossy(payload).trim().to_string();
        if !said.is_empty() {
            return said;
        }
        let log = self.log.lock().unwrap();
        log.back().cloned().unwrap_or_else(|| "no detail".into())
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.stdin = None;
        let asked = Instant::now();
        while asked.elapsed() < EXIT {
            if !matches!(self.child.try_wait(), Ok(None)) {
                return;
            }
            std::thread::sleep(POLL);
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn read_frames(child: &mut Child) -> Receiver<Frame> {
    let (tx, frames) = channel();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = std::thread::Builder::new()
            .name("voice-qwen-out".into())
            .spawn(move || {
                while let Ok(frame) = wire::read(&mut stdout) {
                    if tx.send(frame).is_err() {
                        return;
                    }
                }
            });
    }
    frames
}

fn read_log(child: &mut Child) -> Log {
    let log = Log::default();
    if let Some(stderr) = child.stderr.take() {
        let lines = log.clone();
        let _ = std::thread::Builder::new()
            .name("voice-qwen-log".into())
            .spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    let mut lines = lines.lock().unwrap();
                    if lines.len() == LOG_LINES {
                        lines.pop_front();
                    }
                    lines.push_back(line);
                }
            });
    }
    log
}

#[cfg(windows)]
fn hide_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_window(_: &mut Command) {}
