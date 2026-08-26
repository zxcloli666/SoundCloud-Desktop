//! Spectrum analyser: taps PCM mid-pipeline, runs FFT in a background thread,
//! emits log-scale magnitude bins to the frontend ~30Hz for visualizer canvas.
//!
//! Hot path (audio thread):
//!  - `AnalyserSource::next()` is called per-sample; we do NO allocation, NO logf,
//!    NO blocking. We average channels into mono, then push into a fixed-cap
//!    ring buffer guarded by a Mutex. The lock is taken only once per audio
//!    frame, never per-sample, by accumulating channels first.
//!  - If the FFT thread has the lock (rare, FFT itself is fast), we drop the
//!    frame instead of blocking — visualizer gracefully handles gaps.
//!
//! FFT thread:
//!  - Runs at fixed ~30Hz. 1024-point real FFT on most recent samples.
//!  - Hann window pre-computed once at startup.
//!  - 64 log-spaced bins, normalized + smoothed with prev frame for visual
//!    stability. Sleep-based pacing — no heavy timers.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rodio::source::SeekError;
use rodio::Source;
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;
use crate::rt::AppHandle;
use tauri::Emitter;

use crate::audio::types::{ChannelCount, SampleRate};

const FFT_SIZE: usize = 1024;
const RING_CAPACITY: usize = 4096;
const FFT_INTERVAL_MS: u64 = 33;
pub const NUM_BINS: usize = 64;
const MIN_FREQ_HZ: f32 = 50.0;

pub struct AnalyserBuffer {
    samples: Mutex<VecDeque<f32>>,
    pub sample_rate: AtomicU32,
    pub running: AtomicBool,
    enabled: AtomicBool,
}

impl AnalyserBuffer {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            samples: Mutex::new(VecDeque::with_capacity(RING_CAPACITY)),
            sample_rate: AtomicU32::new(44_100),
            running: AtomicBool::new(true),
            // The visualizer is opt-in. Keeping the PCM tap active while its UI
            // is closed used to take a mutex once per audio frame and run FFTs
            // for every track even though no frontend was listening.
            enabled: AtomicBool::new(false),
        })
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Release);
        if let Ok(mut samples) = self.samples.lock() {
            samples.clear();
        }
    }

    fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Acquire)
    }
}

pub struct AnalyserSource<S: Source<Item = f32>> {
    source: S,
    buffer: Arc<AnalyserBuffer>,
    channels: ChannelCount,
    sample_rate: SampleRate,
    cur_channel: u16,
    accum: f32,
}

impl<S: Source<Item = f32>> AnalyserSource<S> {
    pub fn new(source: S, buffer: Arc<AnalyserBuffer>) -> Self {
        let channels = source.channels();
        let sample_rate = source.sample_rate();
        buffer
            .sample_rate
            .store(sample_rate.get(), Ordering::Relaxed);
        Self {
            source,
            buffer,
            channels,
            sample_rate,
            cur_channel: 0,
            accum: 0.0,
        }
    }
}

impl<S: Source<Item = f32>> Iterator for AnalyserSource<S> {
    type Item = f32;

    fn next(&mut self) -> Option<f32> {
        let sample = self.source.next()?;
        if !self.buffer.is_enabled() {
            self.cur_channel = 0;
            self.accum = 0.0;
            return Some(sample);
        }
        self.accum += sample;
        self.cur_channel += 1;

        // Once per audio frame (all channels seen), push the mono mix.
        if self.cur_channel >= self.channels.get() {
            let mono = self.accum / self.channels.get() as f32;
            self.cur_channel = 0;
            self.accum = 0.0;

            // try_lock — if FFT thread is reading, just drop this frame.
            if let Ok(mut q) = self.buffer.samples.try_lock() {
                if q.len() >= RING_CAPACITY {
                    let drop_n = q.len() - RING_CAPACITY + 1;
                    q.drain(0..drop_n);
                }
                q.push_back(mono);
            }
        }
        Some(sample)
    }
}

impl<S: Source<Item = f32>> Source for AnalyserSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.source.current_span_len()
    }
    fn channels(&self) -> ChannelCount {
        self.channels
    }
    fn sample_rate(&self) -> SampleRate {
        self.sample_rate
    }
    fn total_duration(&self) -> Option<Duration> {
        self.source.total_duration()
    }
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.source.try_seek(pos)
    }
}

/// Background FFT thread. Lives for the whole app lifetime; cheap when no
/// audio is playing (sleep + empty-buffer skip).
pub fn start_fft_thread(app: AppHandle, buffer: Arc<AnalyserBuffer>) {
    std::thread::Builder::new()
        .name("audio-fft".into())
        .spawn(move || run_fft_loop(app, buffer))
        .expect("failed to spawn audio-fft thread");
}

fn run_fft_loop(app: AppHandle, buffer: Arc<AnalyserBuffer>) {
    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);

    // Pre-compute Hann window once.
    let mut window = vec![0.0f32; FFT_SIZE];
    for (i, w) in window.iter_mut().enumerate() {
        *w = 0.5 * (1.0 - (2.0 * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32).cos());
    }

    let mut fft_buf = vec![Complex::new(0.0f32, 0.0); FFT_SIZE];
    let mut bins_smooth = vec![0.0f32; NUM_BINS];
    let mut silence_skips: u32 = 0;
    let mut prev_emit_was_silent = true;

    loop {
        std::thread::sleep(Duration::from_millis(FFT_INTERVAL_MS));
        if !buffer.running.load(Ordering::Relaxed) {
            break;
        }
        if !buffer.is_enabled() {
            silence_skips = 0;
            prev_emit_was_silent = true;
            continue;
        }

        let snapshot: Option<Vec<f32>> = {
            let mut q = buffer.samples.lock().unwrap();
            if q.len() < FFT_SIZE {
                None
            } else {
                let start = q.len() - FFT_SIZE;
                let samples = q.iter().skip(start).copied().collect();
                // Consume the window. If playback is paused no fresh samples
                // arrive, so the analyser emits one zero frame and then parks
                // instead of recomputing the same stale spectrum at 30 Hz.
                q.clear();
                Some(samples)
            }
        };

        let Some(samples) = snapshot else {
            // No fresh samples (paused / loading). After ~4 ticks (~130ms) of
            // silence, emit one zero frame so the canvas can fade out, then go quiet.
            silence_skips = silence_skips.saturating_add(1);
            if !prev_emit_was_silent && silence_skips >= 4 {
                let zeros = vec![0.0f32; NUM_BINS];
                let _ = app.emit("audio:fft", &zeros);
                prev_emit_was_silent = true;
            }
            continue;
        };

        // Quick silence detection — skip FFT for fully zeroed buffers.
        let mut peak = 0.0f32;
        for &s in &samples {
            let a = s.abs();
            if a > peak {
                peak = a;
            }
        }
        if peak < 1e-4 {
            silence_skips = silence_skips.saturating_add(1);
            if !prev_emit_was_silent {
                let zeros = vec![0.0f32; NUM_BINS];
                let _ = app.emit("audio:fft", &zeros);
                prev_emit_was_silent = true;
            }
            continue;
        }
        silence_skips = 0;

        for i in 0..FFT_SIZE {
            fft_buf[i] = Complex::new(samples[i] * window[i], 0.0);
        }
        fft.process(&mut fft_buf);

        let sample_rate = buffer.sample_rate.load(Ordering::Relaxed) as f32;
        let nyquist = (sample_rate * 0.5).max(1.0);
        let mag_count = FFT_SIZE / 2;

        let log_min = MIN_FREQ_HZ.ln();
        let log_max = nyquist.ln();
        let log_range = (log_max - log_min).max(1e-3);

        // Bin-bucketing: distribute FFT magnitudes into log-spaced bins, take max.
        let mut bins = vec![0.0f32; NUM_BINS];
        let nbins = NUM_BINS as f32;
        for (i, c) in fft_buf.iter().take(mag_count).enumerate() {
            let freq = (i as f32) * nyquist / (mag_count as f32);
            if freq < MIN_FREQ_HZ {
                continue;
            }
            let log_freq = freq.ln();
            let pos = ((log_freq - log_min) / log_range).clamp(0.0, 0.999);
            let idx = (pos * nbins) as usize;
            let mag = (c.re * c.re + c.im * c.im).sqrt();
            if mag > bins[idx] {
                bins[idx] = mag;
            }
        }

        // Log-compress + normalize + smooth with previous frame.
        // Emp. normalisation: FFT magnitudes hit ~32 on full-scale music with Hann.
        let inv_log9 = 1.0 / 10.0_f32.ln(); // (1+9).ln()
        for i in 0..NUM_BINS {
            let v = (bins[i] / 32.0).min(1.0);
            let log_v = (1.0 + v * 9.0).ln() * inv_log9;
            bins_smooth[i] = bins_smooth[i] * 0.55 + log_v * 0.45;
            bins[i] = bins_smooth[i];
        }

        if app.emit("audio:fft", &bins).is_ok() {
            prev_emit_was_silent = false;
        }
    }
}
