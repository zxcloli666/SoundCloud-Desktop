use std::sync::atomic::Ordering;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SizedSample, Stream, StreamConfig};

use crate::error::{CaptureError, ErrorCode};

use super::{Msg, SourceCtx};

pub fn run(ctx: SourceCtx) {
    let stream = match open(&ctx) {
        Ok(stream) => stream,
        Err(error) => {
            let _ = ctx.ready.send(Err(error.for_input(&ctx.device.id)));
            return;
        }
    };
    let _ = ctx.ready.send(Ok(()));
    while !ctx.stop.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(20));
    }
    drop(stream);
}

fn open(ctx: &SourceCtx) -> Result<Stream, CaptureError> {
    let host = cpal::default_host();
    let lost = |detail: String| CaptureError::new(ErrorCode::MicLost, detail);
    let id: cpal::DeviceId = ctx.device.id.parse().map_err(|e| lost(format!("{e}")))?;
    let device = host
        .device_by_id(&id)
        .ok_or_else(|| lost("device not found".into()))?;
    let supported = device
        .default_input_config()
        .map_err(|e| CaptureError::classify(&e.to_string()))?;
    let config = supported.config();
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, &config, ctx),
        SampleFormat::I16 => build::<i16>(&device, &config, ctx),
        SampleFormat::U16 => build::<u16>(&device, &config, ctx),
        SampleFormat::I32 => build::<i32>(&device, &config, ctx),
        other => Err(CaptureError::new(
            ErrorCode::Other,
            format!("sample format {other:?}"),
        )),
    }?;
    stream.play()?;
    Ok(stream)
}

fn build<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    ctx: &SourceCtx,
) -> Result<Stream, CaptureError>
where
    T: SizedSample,
    f32: cpal::FromSample<T>,
{
    let channels = config.channels.max(1) as usize;
    let rate = config.sample_rate;
    let input = ctx.input;
    let data_tx = ctx.out.clone();
    let error_tx = ctx.out.clone();
    let scale = 1.0 / channels as f32;
    let stream = device.build_input_stream(
        config,
        move |data: &[T], _| {
            let samples = data
                .chunks_exact(channels)
                .map(|f| f.iter().map(|s| s.to_sample::<f32>()).sum::<f32>() * scale)
                .collect();
            let _ = data_tx.send(Msg::Chunk {
                input,
                samples,
                rate,
            });
        },
        move |error| {
            let _ = error_tx.send(Msg::Lost {
                input,
                error: CaptureError::from(error),
            });
        },
        None,
    )?;
    Ok(stream)
}
