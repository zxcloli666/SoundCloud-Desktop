mod cpal_input;
mod pulse_input;

use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::sync::mpsc::Sender;

use crate::device::Device;
use crate::devices::pulse::ID_PREFIX;
use crate::error::CaptureError;

pub enum Msg {
    Chunk {
        input: usize,
        samples: Vec<f32>,
        rate: u32,
    },
    Lost {
        input: usize,
        error: CaptureError,
    },
}

pub struct SourceCtx {
    pub input: usize,
    pub device: Device,
    pub out: Sender<Msg>,
    pub stop: Arc<AtomicBool>,
    pub ready: Sender<Result<(), CaptureError>>,
}

pub type OpenFn = Arc<dyn Fn(SourceCtx) + Send + Sync>;

pub fn real() -> OpenFn {
    Arc::new(|ctx| {
        if ctx.device.id.starts_with(ID_PREFIX) {
            pulse_input::run(ctx)
        } else {
            cpal_input::run(ctx)
        }
    })
}
