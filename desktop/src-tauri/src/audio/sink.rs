use std::num::NonZero;
use std::sync::Arc;

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{BufferSize, FromSample, SampleFormat, SizedSample, StreamConfig};
use rodio::mixer::Mixer;
use rodio::stream::DeviceSinkError;

use crate::audio::master::{Master, Render};

const BUFFERS_PER_SECOND: u32 = 20;

pub struct DeviceSink {
    mixer: Mixer,
    voice: Mixer,
    config: SinkConfig,
    _stream: cpal::Stream,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SinkConfig {
    pub channels: u16,
    pub sample_rate: u32,
    pub sample_format: SampleFormat,
    pub buffer_size: BufferSize,
}

impl DeviceSink {
    pub fn mixer(&self) -> &Mixer {
        &self.mixer
    }

    pub fn voice(&self) -> &Mixer {
        &self.voice
    }

    pub fn config(&self) -> &SinkConfig {
        &self.config
    }
}

pub fn device_config(device: &cpal::Device) -> Result<SinkConfig, DeviceSinkError> {
    let config = device
        .default_output_config()
        .map_err(DeviceSinkError::DefaultSinkConfigError)?;
    Ok(SinkConfig {
        channels: config.channels(),
        sample_rate: config.sample_rate(),
        sample_format: config.sample_format(),
        buffer_size: BufferSize::Fixed(buffer_frames(config.sample_rate())),
    })
}

fn buffer_frames(sample_rate: u32) -> u32 {
    let frames = sample_rate / BUFFERS_PER_SECOND;
    if frames <= 1 {
        return 1;
    }
    let above = frames.next_power_of_two();
    let below = above >> 1;
    if frames - below <= above - frames {
        below
    } else {
        above
    }
}

pub fn open<E>(
    device: &cpal::Device,
    config: SinkConfig,
    master: &Arc<Master>,
    error_callback: E,
) -> Result<DeviceSink, DeviceSinkError>
where
    E: FnMut(cpal::StreamError) + Send + 'static,
{
    let channels = NonZero::new(config.channels).ok_or(DeviceSinkError::NoDevice)?;
    let sample_rate = NonZero::new(config.sample_rate).ok_or(DeviceSinkError::NoDevice)?;
    let (mixer, music) = rodio::mixer::mixer(channels, sample_rate);
    let (voice, speech) = rodio::mixer::mixer(channels, sample_rate);
    let render = Render::new(master.clone(), music, speech);
    let stream = match config.sample_format {
        SampleFormat::F32 => build::<f32, E>(device, &config, render, error_callback),
        SampleFormat::F64 => build::<f64, E>(device, &config, render, error_callback),
        SampleFormat::I8 => build::<i8, E>(device, &config, render, error_callback),
        SampleFormat::I16 => build::<i16, E>(device, &config, render, error_callback),
        SampleFormat::I24 => build::<cpal::I24, E>(device, &config, render, error_callback),
        SampleFormat::I32 => build::<i32, E>(device, &config, render, error_callback),
        SampleFormat::I64 => build::<i64, E>(device, &config, render, error_callback),
        SampleFormat::U8 => build::<u8, E>(device, &config, render, error_callback),
        SampleFormat::U16 => build::<u16, E>(device, &config, render, error_callback),
        SampleFormat::U24 => build::<cpal::U24, E>(device, &config, render, error_callback),
        SampleFormat::U32 => build::<u32, E>(device, &config, render, error_callback),
        SampleFormat::U64 => build::<u64, E>(device, &config, render, error_callback),
        _ => return Err(DeviceSinkError::UnsupportedSampleFormat),
    }
    .map_err(DeviceSinkError::BuildError)?;
    stream.play().map_err(DeviceSinkError::PlayError)?;
    Ok(DeviceSink {
        mixer,
        voice,
        config,
        _stream: stream,
    })
}

fn build<T, E>(
    device: &cpal::Device,
    config: &SinkConfig,
    mut render: Render,
    error_callback: E,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: SizedSample + FromSample<f32>,
    E: FnMut(cpal::StreamError) + Send + 'static,
{
    let stream_config = StreamConfig {
        channels: config.channels,
        sample_rate: config.sample_rate,
        buffer_size: config.buffer_size,
    };
    device.build_output_stream::<T, _, _>(
        &stream_config,
        move |data, _| render.fill(data),
        error_callback,
        None,
    )
}

#[cfg(test)]
mod tests {
    use super::buffer_frames;

    #[test]
    fn buffer_is_the_power_of_two_nearest_to_50_ms() {
        assert_eq!(buffer_frames(44_100), 2048);
        assert_eq!(buffer_frames(48_000), 2048);
        assert_eq!(buffer_frames(88_200), 4096);
        assert_eq!(buffer_frames(96_000), 4096);
        assert_eq!(buffer_frames(192_000), 8192);
        assert_eq!(buffer_frames(22_050), 1024);
        assert_eq!(buffer_frames(8_000), 512);
        assert_eq!(buffer_frames(20), 1);
    }
}
