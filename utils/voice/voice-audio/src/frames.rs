use rubato::{FftFixedIn, Resampler};

pub const RATE: u32 = 16_000;
pub const FRAME: usize = 160;

pub type Frame = [f32; FRAME];

pub struct Framer {
    resampler: Option<FftFixedIn<f32>>,
    pending: Vec<f32>,
    resampled: Vec<f32>,
}

impl Framer {
    pub fn new(rate: u32) -> Result<Self, String> {
        let resampler = if rate == RATE {
            None
        } else {
            let chunk = (rate as usize / 100).max(1);
            Some(
                FftFixedIn::<f32>::new(rate as usize, RATE as usize, chunk, 2, 1)
                    .map_err(|e| e.to_string())?,
            )
        };
        Ok(Self {
            resampler,
            pending: Vec::new(),
            resampled: Vec::new(),
        })
    }

    pub fn push(&mut self, mono: &[f32]) -> Vec<Frame> {
        match self.resampler.as_mut() {
            None => self.resampled.extend_from_slice(mono),
            Some(resampler) => {
                self.pending.extend_from_slice(mono);
                loop {
                    let need = resampler.input_frames_next();
                    if self.pending.len() < need {
                        break;
                    }
                    let chunk: Vec<f32> = self.pending.drain(..need).collect();
                    match resampler.process(&[chunk], None) {
                        Ok(out) => self.resampled.extend_from_slice(&out[0]),
                        Err(_) => break,
                    }
                }
            }
        }
        let whole = self.resampled.len() / FRAME * FRAME;
        self.resampled
            .drain(..whole)
            .collect::<Vec<f32>>()
            .chunks_exact(FRAME)
            .map(|c| {
                let mut frame = [0.0; FRAME];
                frame.copy_from_slice(c);
                frame
            })
            .collect()
    }
}

pub fn rms(frame: &[f32]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt()
}

pub fn energy(frame: &[f32]) -> f32 {
    frame.iter().map(|s| s * s).sum::<f32>() / frame.len().max(1) as f32
}
