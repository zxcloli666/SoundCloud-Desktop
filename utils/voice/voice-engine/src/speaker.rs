use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::mpsc::{Receiver, channel};
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample, Stream, StreamConfig};

use crate::clip::Clip;

const DRAIN: Duration = Duration::from_millis(150);

pub struct Playing {
    stop: Arc<AtomicBool>,
}

impl Playing {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

pub fn play(device: Option<String>, clip: Clip) -> Result<(Playing, Receiver<()>), String> {
    let stop = Arc::new(AtomicBool::new(false));
    let (ended_tx, ended) = channel();
    let (ready_tx, ready) = channel();
    let flag = stop.clone();
    std::thread::Builder::new()
        .name("voice-speaker".into())
        .spawn(move || {
            let done = Arc::new(AtomicBool::new(false));
            let stream = match open(device.as_deref(), &clip, done.clone()) {
                Ok(stream) => stream,
                Err(error) => {
                    let _ = ready_tx.send(Err(error));
                    return;
                }
            };
            let _ = ready_tx.send(Ok(()));
            while !done.load(Ordering::Relaxed) && !flag.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(10));
            }
            if !flag.load(Ordering::Relaxed) {
                std::thread::sleep(DRAIN);
            }
            drop(stream);
            let _ = ended_tx.send(());
        })
        .map_err(|e| e.to_string())?;
    ready
        .recv()
        .map_err(|_| "speaker thread ended".to_string())??;
    Ok((Playing { stop }, ended))
}

fn open(id: Option<&str>, clip: &Clip, done: Arc<AtomicBool>) -> Result<Stream, String> {
    let host = cpal::default_host();
    let device = match id {
        Some(id) => {
            let id: cpal::DeviceId = id.parse().map_err(|e| format!("{e}"))?;
            host.device_by_id(&id).ok_or("output device not found")?
        }
        None => host.default_output_device().ok_or("no output device")?,
    };
    let supported = device.default_output_config().map_err(|e| e.to_string())?;
    let config = supported.config();
    let samples = Arc::new(clip.at_rate(config.sample_rate));
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, &config, samples, done),
        SampleFormat::I16 => build::<i16>(&device, &config, samples, done),
        SampleFormat::U16 => build::<u16>(&device, &config, samples, done),
        SampleFormat::I32 => build::<i32>(&device, &config, samples, done),
        other => Err(format!("sample format {other:?}")),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    Ok(stream)
}

fn build<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    samples: Arc<Vec<f32>>,
    done: Arc<AtomicBool>,
) -> Result<Stream, String>
where
    T: SizedSample + FromSample<f32>,
{
    let channels = config.channels.max(1) as usize;
    let at = AtomicUsize::new(0);
    device
        .build_output_stream(
            config,
            move |out: &mut [T], _| {
                let mut pos = at.load(Ordering::Relaxed);
                for frame in out.chunks_mut(channels) {
                    let value = samples.get(pos).copied().unwrap_or(0.0);
                    pos += 1;
                    for slot in frame {
                        *slot = T::from_sample(value);
                    }
                }
                at.store(pos, Ordering::Relaxed);
                if pos >= samples.len() {
                    done.store(true, Ordering::Relaxed);
                }
            },
            |_| {},
            None,
        )
        .map_err(|e| e.to_string())
}
