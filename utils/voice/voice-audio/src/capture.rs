use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, channel};
use std::thread::JoinHandle;
use std::time::Duration;

use crate::aec::{Aec, AecConfig};
use crate::device::{Device, DeviceList};
use crate::error::{CaptureError, ErrorCode};
use crate::frames::RATE;
use crate::permission;
use crate::ref_sync::RefSync;
use crate::routing::{EchoMode, ListenMode, OutputInfo, Purpose, echo_on, pick_inputs};
use crate::source::{self, OpenFn, SourceCtx};
use crate::tap::RefTap;
use crate::worker::{self, Lane};

const OPEN_TIMEOUT: Duration = Duration::from_secs(8);
const REF_TARGET_MS: u32 = 16;

#[derive(Clone, Debug)]
pub struct Request {
    pub purpose: Purpose,
    pub mode: ListenMode,
    pub chosen: Vec<String>,
    pub echo: EchoMode,
    pub noise_suppression: bool,
    pub output: Option<OutputInfo>,
}

#[derive(Debug)]
pub enum Event {
    Frame { input: String, samples: Vec<f32> },
    Level { input: String, rms: f32 },
    Selected { input: String },
    Error(CaptureError),
}

pub struct Capture {
    tap: RefTap,
    open: OpenFn,
    check_permission: bool,
}

pub struct Session {
    pub events: Receiver<Event>,
    pub inputs: Vec<Device>,
    pub echo_cancel: Vec<bool>,
    stop: Arc<AtomicBool>,
    threads: Vec<JoinHandle<()>>,
}

impl Capture {
    pub fn new(tap: RefTap) -> Self {
        Self {
            tap,
            open: source::real(),
            check_permission: true,
        }
    }

    pub fn with_source(tap: RefTap, open: OpenFn) -> Self {
        Self {
            tap,
            open,
            check_permission: false,
        }
    }

    pub fn start(&self, request: &Request, devices: &DeviceList) -> Result<Session, CaptureError> {
        if self.check_permission {
            permission::check()?;
        }
        let picked = pick_inputs(
            request.mode,
            &request.chosen,
            &devices.inputs,
            request.output.as_ref(),
            request.purpose,
        );
        if picked.is_empty() {
            return Err(CaptureError::new(ErrorCode::MicLost, "no input device"));
        }

        let stop = Arc::new(AtomicBool::new(false));
        let (msg_tx, msg_rx) = channel();
        let (event_tx, events) = channel();
        let mut threads = Vec::new();
        let mut readies = Vec::new();
        for (index, device) in picked.iter().enumerate() {
            let (ready_tx, ready_rx) = channel();
            let ctx = SourceCtx {
                input: index,
                device: device.clone(),
                out: msg_tx.clone(),
                stop: stop.clone(),
                ready: ready_tx,
            };
            let open = self.open.clone();
            let thread = std::thread::Builder::new()
                .name(format!("voice-input-{index}"))
                .spawn(move || open(ctx))
                .map_err(|e| CaptureError::new(ErrorCode::Other, e.to_string()))?;
            threads.push(thread);
            readies.push(ready_rx);
        }
        drop(msg_tx);

        let mut opened = Vec::new();
        let mut failures = Vec::new();
        for (index, ready) in readies.into_iter().enumerate() {
            match ready.recv_timeout(OPEN_TIMEOUT) {
                Ok(Ok(())) => opened.push(index),
                Ok(Err(error)) => failures.push(error),
                Err(_) => failures.push(
                    CaptureError::new(ErrorCode::Other, "open timed out")
                        .for_input(&picked[index].id),
                ),
            }
        }
        if opened.is_empty() {
            stop.store(true, Ordering::Relaxed);
            for thread in threads {
                let _ = thread.join();
            }
            return Err(failures
                .into_iter()
                .next()
                .unwrap_or_else(|| CaptureError::new(ErrorCode::MicLost, "no input opened")));
        }
        for error in failures {
            let _ = event_tx.send(Event::Error(error));
        }

        let mut lanes = Vec::new();
        let mut echo_cancel = Vec::new();
        let mut inputs = Vec::new();
        for &index in &opened {
            let device = picked[index].clone();
            let aec_wanted = request.purpose != Purpose::Meter
                && echo_on(request.echo, &device, request.output.as_ref());
            let aec = if aec_wanted {
                Aec::new(AecConfig {
                    sample_rate: RATE,
                    noise_suppression: request.noise_suppression,
                    delay_ms: None,
                })
                .ok()
            } else {
                None
            };
            echo_cancel.push(aec.is_some());
            inputs.push(device.clone());
            lanes.push(Lane::new(
                index,
                device,
                aec,
                RefSync::new(RATE, REF_TARGET_MS, true),
            ));
        }

        let tap = self.tap.clone();
        let uses_tap = echo_cancel.iter().any(|on| *on);
        if uses_tap {
            tap.watch();
        }
        let purpose = request.purpose;
        let worker_stop = stop.clone();
        let worker_thread = std::thread::Builder::new()
            .name("voice-capture".into())
            .spawn(move || {
                worker::run(msg_rx, event_tx, lanes, purpose, &tap, &worker_stop);
                if uses_tap {
                    tap.unwatch();
                }
            })
            .map_err(|e| CaptureError::new(ErrorCode::Other, e.to_string()))?;
        threads.push(worker_thread);

        Ok(Session {
            events,
            inputs,
            echo_cancel,
            stop,
            threads,
        })
    }
}

impl Session {
    pub fn stop(self) {}
}

impl Drop for Session {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        for thread in self.threads.drain(..) {
            let _ = thread.join();
        }
    }
}
