use crate::audio::{db, power};

pub struct Layout {
    pub rate: usize,
    pub total: usize,
}

impl Layout {
    pub fn music_only_a(&self) -> (usize, usize) {
        (0, self.total / 3)
    }

    pub fn double_talk(&self) -> (usize, usize) {
        (self.total / 3, 2 * self.total / 3)
    }

    pub fn music_only_c(&self) -> (usize, usize) {
        (2 * self.total / 3, self.total)
    }
}

pub fn erle_blocks(mic: &[f32], out: &[f32], range: (usize, usize), block: usize) -> Vec<f64> {
    (range.0..range.1.saturating_sub(block - 1))
        .step_by(block)
        .map(|start| db(power(&mic[start..start + block])) - db(power(&out[start..start + block])))
        .collect()
}

pub fn settle_seconds(blocks: &[f64], block_seconds: f64, threshold_db: f64) -> f64 {
    blocks
        .iter()
        .rposition(|&e| e < threshold_db)
        .map_or(0.0, |i| (i + 1) as f64 * block_seconds)
}

pub fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len().max(1) as f64
}

pub fn percentile(values: &[f64], p: f64) -> f64 {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    sorted[((sorted.len() - 1) as f64 * p) as usize]
}

pub fn si_sdr(estimate: &[f32], target: &[f32]) -> (f64, f64) {
    let dot: f64 = estimate
        .iter()
        .zip(target)
        .map(|(&e, &t)| e as f64 * t as f64)
        .sum();
    let energy: f64 = target.iter().map(|&t| t as f64 * t as f64).sum();
    let alpha = dot / energy.max(1e-20);
    let mut signal = 0.0;
    let mut error = 0.0;
    for (&e, &t) in estimate.iter().zip(target) {
        let scaled = alpha * t as f64;
        signal += scaled * scaled;
        let diff = e as f64 - scaled;
        error += diff * diff;
    }
    (db(signal) - db(error), 20.0 * alpha.abs().max(1e-9).log10())
}
