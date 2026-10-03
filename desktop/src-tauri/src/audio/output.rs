use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rodio::mixer::Mixer;
use rodio::stream::MixerDeviceSink;

use crate::app::diagnostics;
use crate::audio::device::open_device_sink;
use crate::audio::types::AudioThreadCmd;
use crate::rt::AppHandle;

const RECONNECT_DELAY: Duration = Duration::from_millis(500);
const MAX_RECONNECT_DELAY: Duration = Duration::from_secs(10);
const RECONNECT_BACKOFF_WINDOW: Duration = Duration::from_secs(30);
const SILENT_TICK: Duration = Duration::from_millis(20);
const SILENT_SAMPLES_PER_TICK: usize = 2 * 44_100 / 50;

pub struct OutputHandles {
    pub app: AppHandle,
    pub cmd_tx: Sender<AudioThreadCmd>,
    pub error_flag: Arc<AtomicBool>,
    pub reconnected: Arc<AtomicBool>,
}

pub fn spawn_output_thread(
    handles: OutputHandles,
    cmd_rx: Receiver<AudioThreadCmd>,
) -> Arc<Mutex<Mixer>> {
    let (mixer_tx, mixer_rx) = std::sync::mpsc::channel();
    std::thread::Builder::new()
        .name("audio-output".into())
        .spawn(move || {
            let mut thread = OutputThread::start(handles);
            mixer_tx.send(thread.shared_mixer.clone()).ok();
            thread.run(cmd_rx);
        })
        .expect("failed to spawn audio thread");
    mixer_rx.recv().expect("audio thread failed to init")
}

enum Output {
    Device(MixerDeviceSink),
    Silent { mixer: Mixer, _stop: Sender<()> },
}

impl Output {
    fn silent() -> Self {
        let (mixer, mut source) = rodio::mixer::mixer(rodio::nz!(2), rodio::nz!(44_100));
        let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
        std::thread::Builder::new()
            .name("audio-silent-output".into())
            .spawn(move || {
                while stop_rx.recv_timeout(SILENT_TICK) == Err(RecvTimeoutError::Timeout) {
                    for _ in 0..SILENT_SAMPLES_PER_TICK {
                        source.next();
                    }
                }
            })
            .ok();
        Output::Silent {
            mixer,
            _stop: stop_tx,
        }
    }

    fn mixer(&self) -> &Mixer {
        match self {
            Output::Device(sink) => sink.mixer(),
            Output::Silent { mixer, .. } => mixer,
        }
    }

    fn is_silent(&self) -> bool {
        matches!(self, Output::Silent { .. })
    }
}

struct OutputThread {
    handles: OutputHandles,
    output: Output,
    shared_mixer: Arc<Mutex<Mixer>>,
    reconnect_at: Option<Instant>,
    reconnect_delay: Duration,
    last_reconnect: Option<Instant>,
}

impl OutputThread {
    fn start(handles: OutputHandles) -> Self {
        let output = open_default(&handles);
        let shared_mixer = Arc::new(Mutex::new(output.mixer().clone()));
        let reconnect_at = output.is_silent().then(|| Instant::now() + RECONNECT_DELAY);
        Self {
            handles,
            output,
            shared_mixer,
            reconnect_at,
            reconnect_delay: RECONNECT_DELAY,
            last_reconnect: None,
        }
    }

    fn run(&mut self, cmd_rx: Receiver<AudioThreadCmd>) {
        loop {
            let cmd = match self.reconnect_at {
                Some(at) => cmd_rx.recv_timeout(at.saturating_duration_since(Instant::now())),
                None => cmd_rx.recv().map_err(|_| RecvTimeoutError::Disconnected),
            };

            match cmd {
                Ok(AudioThreadCmd::SwitchDevice { name, reply }) => {
                    let opened = self.switch_device(name);
                    reply
                        .send(opened.map(|()| self.output.mixer().clone()))
                        .ok();
                }
                Ok(AudioThreadCmd::Reconnect) => self.schedule_reconnect(),
                Err(RecvTimeoutError::Timeout) => self.reconnect(),
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }
    }

    fn switch_device(&mut self, name: Option<String>) -> Result<(), String> {
        self.output = Output::silent();
        let opened = match open_device_sink(
            name.as_deref(),
            &self.handles.cmd_tx,
            &self.handles.error_flag,
        ) {
            Ok(sink) => {
                self.output = device_output(&self.handles, name.as_deref(), sink);
                Ok(())
            }
            Err(error) => {
                self.output = open_default(&self.handles);
                Err(error)
            }
        };
        *self.shared_mixer.lock().unwrap() = self.output.mixer().clone();
        self.reconnect_at = self
            .output
            .is_silent()
            .then(|| Instant::now() + self.reconnect_delay);
        opened
    }

    fn schedule_reconnect(&mut self) {
        if self.reconnect_at.is_some() {
            return;
        }
        let failing_again = self
            .last_reconnect
            .is_some_and(|at| at.elapsed() < RECONNECT_BACKOFF_WINDOW);
        if failing_again {
            self.reconnect_delay = (self.reconnect_delay * 2).min(MAX_RECONNECT_DELAY);
            diagnostics::log_native(
                &self.handles.app,
                "WARN",
                format!(
                    "[Audio] Output keeps failing, reconnecting in {} ms",
                    self.reconnect_delay.as_millis()
                ),
            );
        } else {
            self.reconnect_delay = RECONNECT_DELAY;
        }
        self.reconnect_at = Some(Instant::now() + self.reconnect_delay);
    }

    fn reconnect(&mut self) {
        self.last_reconnect = Some(Instant::now());
        let was_silent = self.output.is_silent();
        if !was_silent {
            self.output = Output::silent();
        }

        match open_device_sink(None, &self.handles.cmd_tx, &self.handles.error_flag) {
            Ok(sink) => {
                self.output = device_output(&self.handles, None, sink);
                self.reconnect_at = None;
            }
            Err(error) => {
                if !was_silent {
                    log_no_output(&self.handles, &error);
                }
                self.reconnect_delay = (self.reconnect_delay * 2).min(MAX_RECONNECT_DELAY);
                self.reconnect_at = Some(Instant::now() + self.reconnect_delay);
            }
        }

        if !(was_silent && self.output.is_silent()) {
            *self.shared_mixer.lock().unwrap() = self.output.mixer().clone();
            self.handles.reconnected.store(true, Ordering::Release);
        }
    }
}

fn open_default(handles: &OutputHandles) -> Output {
    match open_device_sink(None, &handles.cmd_tx, &handles.error_flag) {
        Ok(sink) => device_output(handles, None, sink),
        Err(error) => {
            log_no_output(handles, &error);
            Output::silent()
        }
    }
}

fn device_output(handles: &OutputHandles, name: Option<&str>, sink: MixerDeviceSink) -> Output {
    let config = sink.config();
    diagnostics::log_native(
        &handles.app,
        "INFO",
        format!(
            "[Audio] Output opened on {}: {} ch, {} Hz, {:?}, buffer {:?}",
            name.unwrap_or("default"),
            config.channel_count(),
            config.sample_rate(),
            config.sample_format(),
            config.buffer_size(),
        ),
    );
    Output::Device(sink)
}

fn log_no_output(handles: &OutputHandles, error: &str) {
    diagnostics::log_native(
        &handles.app,
        "WARN",
        format!("[Audio] {error}, playing silently until an output device appears"),
    );
}
