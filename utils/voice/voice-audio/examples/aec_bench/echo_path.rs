use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use rustfft::FftPlanner;
use rustfft::num_complex::Complex;

pub fn gaussian(rng: &mut StdRng) -> f32 {
    let u1: f32 = rng.random::<f32>().max(1e-9);
    let u2: f32 = rng.random();
    (-2.0 * u1.ln()).sqrt() * (std::f32::consts::TAU * u2).cos()
}

pub fn white_noise(len: usize, seed: u64) -> Vec<f32> {
    let mut rng = StdRng::seed_from_u64(seed);
    (0..len).map(|_| gaussian(&mut rng)).collect()
}

pub fn delay(x: &[f32], samples: usize) -> Vec<f32> {
    let mut out = vec![0.0; samples];
    out.extend_from_slice(&x[..x.len() - samples]);
    out
}

pub fn soft_clip(x: &mut [f32]) {
    const DRIVE: f32 = 3.0;
    x.iter_mut().for_each(|v| *v = (*v * DRIVE).tanh() / DRIVE);
}

pub fn speaker_highpass(x: &mut [f32], rate: u32) {
    let w0 = std::f32::consts::TAU * 180.0 / rate as f32;
    let alpha = w0.sin() / (2.0 * std::f32::consts::FRAC_1_SQRT_2);
    let cos = w0.cos();
    let a0 = 1.0 + alpha;
    let b0 = (1.0 + cos) / 2.0 / a0;
    let b1 = -(1.0 + cos) / a0;
    let b2 = b0;
    let a1 = -2.0 * cos / a0;
    let a2 = (1.0 - alpha) / a0;
    let (mut x1, mut x2, mut y1, mut y2) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
    for v in x.iter_mut() {
        let y = b0 * *v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = *v;
        y2 = y1;
        y1 = y;
        *v = y;
    }
}

pub fn synthetic_rir(rate: u32, rt60: f32, seed: u64) -> Vec<f32> {
    let len = (rate as f32 * rt60) as usize;
    let skip = (rate as f32 * 0.002) as usize;
    let decay = 6.9078 / (rate as f32 * rt60);
    let mut noise = white_noise(len, seed);
    for (k, v) in noise.iter_mut().enumerate() {
        *v = if k < skip {
            0.0
        } else {
            *v * (-decay * k as f32).exp()
        };
    }
    let tail_energy: f32 = noise.iter().map(|v| v * v).sum();
    let gain = (0.4 / tail_energy).sqrt();
    noise.iter_mut().for_each(|v| *v *= gain);
    noise[0] = 1.0;
    noise
}

pub fn convolve(x: &[f32], h: &[f32]) -> Vec<f32> {
    let size = (x.len() + h.len()).next_power_of_two();
    let mut planner = FftPlanner::<f32>::new();
    let forward = planner.plan_fft_forward(size);
    let inverse = planner.plan_fft_inverse(size);
    let mut a: Vec<Complex<f32>> = x.iter().map(|&v| Complex::new(v, 0.0)).collect();
    a.resize(size, Complex::new(0.0, 0.0));
    let mut b: Vec<Complex<f32>> = h.iter().map(|&v| Complex::new(v, 0.0)).collect();
    b.resize(size, Complex::new(0.0, 0.0));
    forward.process(&mut a);
    forward.process(&mut b);
    for (p, q) in a.iter_mut().zip(&b) {
        *p *= *q;
    }
    inverse.process(&mut a);
    let norm = 1.0 / size as f32;
    a.iter().take(x.len()).map(|c| c.re * norm).collect()
}

pub fn echo_at_speaker_clock(reference: &[f32], rate: u32, delay_ms: u32, rt60: f32) -> Vec<f32> {
    let mut x = delay(reference, (rate * delay_ms / 1000) as usize);
    soft_clip(&mut x);
    speaker_highpass(&mut x, rate);
    let rir = synthetic_rir(rate, rt60, 7);
    convolve(&x, &rir)
}
