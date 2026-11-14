use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Fft, FixedSync, Resampler};

use crate::SAMPLE_RATE;

pub fn to_16k(samples: &[f32], rate: u32) -> Result<Vec<f32>, String> {
    if rate as i32 == SAMPLE_RATE {
        return Ok(samples.to_vec());
    }
    let mut resampler = Fft::<f32>::new(
        rate as usize,
        SAMPLE_RATE as usize,
        1024,
        1,
        FixedSync::Both,
    )
    .map_err(|e| e.to_string())?;
    let input = InterleavedSlice::new(samples, 1, samples.len()).map_err(|e| e.to_string())?;
    let out = resampler
        .process_all(&input, samples.len(), None)
        .map_err(|e| e.to_string())?;
    Ok(out.take_data())
}
