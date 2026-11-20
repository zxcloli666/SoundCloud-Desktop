use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;

use crate::devices::pulse::ID_PREFIX;
use crate::error::{CaptureError, ErrorCode};

use super::{Msg, SourceCtx};

const READ_SAMPLES: usize = 320;

pub fn run(ctx: SourceCtx) {
    let name = ctx.device.id.trim_start_matches(ID_PREFIX).to_string();
    let spawned = Command::new("parec")
        .args([
            "--device",
            &name,
            "--rate=16000",
            "--channels=1",
            "--format=float32le",
            "--latency-msec=20",
            "--raw",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();
    let mut child = match spawned {
        Ok(child) => child,
        Err(e) => {
            let _ = ctx.ready.send(Err(CaptureError::new(
                ErrorCode::Other,
                format!("parec: {e}"),
            )
            .for_input(&ctx.device.id)));
            return;
        }
    };
    let Some(mut stdout) = child.stdout.take() else {
        return;
    };
    let mut bytes = vec![0u8; READ_SAMPLES * 4];
    let mut started = false;
    loop {
        if ctx.stop.load(Ordering::Relaxed) {
            break;
        }
        if stdout.read_exact(&mut bytes).is_err() {
            let mut text = String::new();
            if let Some(mut stderr) = child.stderr.take() {
                let _ = stderr.read_to_string(&mut text);
            }
            let detail = if text.trim().is_empty() {
                "parec ended".to_string()
            } else {
                text
            };
            let error = match CaptureError::classify(&detail) {
                e if e.code == ErrorCode::Other => CaptureError::new(ErrorCode::MicLost, detail),
                e => e,
            };
            if started {
                let _ = ctx.out.send(Msg::Lost {
                    input: ctx.input,
                    error: error.for_input(&ctx.device.id),
                });
            } else {
                let _ = ctx.ready.send(Err(error.for_input(&ctx.device.id)));
            }
            break;
        }
        if !started {
            started = true;
            let _ = ctx.ready.send(Ok(()));
        }
        let samples = bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
            .collect();
        let _ = ctx.out.send(Msg::Chunk {
            input: ctx.input,
            samples,
            rate: 16_000,
        });
    }
    let _ = child.kill();
    let _ = child.wait();
}
