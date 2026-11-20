use std::path::Path;

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

pub fn load_mono(path: &Path, rate: u32) -> Vec<f32> {
    let mut reader = hound::WavReader::open(path).unwrap();
    let spec = reader.spec();
    let channels = spec.channels as usize;
    let scale = 1.0 / (1u64 << (spec.bits_per_sample - 1)) as f32;
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .samples::<i32>()
            .map(|s| s.unwrap() as f32 * scale)
            .collect(),
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap()).collect(),
    };
    let mono: Vec<f32> = samples
        .chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();
    if spec.sample_rate == rate {
        return mono;
    }
    resample(&mono, rate as f64 / spec.sample_rate as f64)
}

pub fn resample(input: &[f32], ratio: f64) -> Vec<f32> {
    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Cubic,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };
    let chunk = 1024;
    let mut resampler = SincFixedIn::<f32>::new(ratio, 1.0, params, chunk, 1).unwrap();
    let delay = resampler.output_delay();
    let wanted = (input.len() as f64 * ratio).round() as usize;
    let mut out: Vec<f32> = Vec::with_capacity(wanted + delay + 2 * chunk);
    let mut pos = 0;
    while pos + chunk <= input.len() {
        let block = resampler
            .process(&[&input[pos..pos + chunk]], None)
            .unwrap();
        out.extend_from_slice(&block[0]);
        pos += chunk;
    }
    let tail = resampler
        .process_partial(Some(&[&input[pos..]]), None)
        .unwrap();
    out.extend_from_slice(&tail[0]);
    let flush = resampler.process_partial::<&[f32]>(None, None).unwrap();
    out.extend_from_slice(&flush[0]);
    let mut result: Vec<f32> = out.into_iter().skip(delay).take(wanted).collect();
    result.resize(wanted, 0.0);
    result
}

pub fn power(x: &[f32]) -> f64 {
    x.iter().map(|&v| v as f64 * v as f64).sum::<f64>() / x.len().max(1) as f64
}

pub fn db(power: f64) -> f64 {
    10.0 * (power + 1e-20).log10()
}

pub fn scale_to_db(x: &mut [f32], rms_dbfs: f64) {
    let gain = 10f64.powf(rms_dbfs / 20.0) / power(x).sqrt().max(1e-12);
    x.iter_mut().for_each(|v| *v = (*v as f64 * gain) as f32);
}
