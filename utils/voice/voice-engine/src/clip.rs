use std::io::Cursor;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Clip {
    pub samples: Vec<f32>,
    pub rate: u32,
}

impl Clip {
    pub fn from_wav(bytes: &[u8]) -> Result<Clip, String> {
        let mut reader = hound::WavReader::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
        let spec = reader.spec();
        let channels = spec.channels.max(1) as usize;
        let all: Vec<f32> = match spec.sample_format {
            hound::SampleFormat::Float => reader
                .samples::<f32>()
                .collect::<Result<_, _>>()
                .map_err(|e| e.to_string())?,
            hound::SampleFormat::Int => {
                let scale = (1u64 << (spec.bits_per_sample - 1)) as f32;
                reader
                    .samples::<i32>()
                    .map(|s| s.map(|v| v as f32 / scale))
                    .collect::<Result<_, _>>()
                    .map_err(|e| e.to_string())?
            }
        };
        let samples = all
            .chunks(channels)
            .map(|frame| frame.iter().sum::<f32>() / channels as f32)
            .collect();
        Ok(Clip {
            samples,
            rate: spec.sample_rate,
        })
    }

    pub fn seconds(&self) -> f32 {
        if self.rate == 0 {
            return 0.0;
        }
        self.samples.len() as f32 / self.rate as f32
    }

    pub fn at_rate(&self, rate: u32) -> Vec<f32> {
        if rate == self.rate || self.rate == 0 || self.samples.is_empty() {
            return self.samples.clone();
        }
        let step = self.rate as f64 / rate as f64;
        let count = (self.samples.len() as f64 / step) as usize;
        let last = self.samples.len() - 1;
        (0..count)
            .map(|i| {
                let at = i as f64 * step;
                let left = at as usize;
                let right = (left + 1).min(last);
                let frac = (at - left as f64) as f32;
                self.samples[left] * (1.0 - frac) + self.samples[right] * frac
            })
            .collect()
    }
}
