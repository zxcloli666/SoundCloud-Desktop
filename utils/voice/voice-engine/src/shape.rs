use signalsmith_stretch::Stretch;

pub struct Shaper {
    stretch: Option<Stretching>,
}

struct Stretching {
    stretch: Stretch,
    speed: f64,
    owed: f64,
    skip: usize,
}

impl Shaper {
    pub fn new(rate: u32, speed: f32, pitch: f32) -> Shaper {
        let speed = speed.clamp(0.5, 2.0);
        let pitch = pitch.clamp(-12.0, 12.0);
        let shaped = (speed - 1.0).abs() >= 0.01 || pitch.abs() >= 0.05;
        Shaper {
            stretch: shaped.then(|| Stretching::new(rate, speed, pitch)),
        }
    }

    pub fn push(&mut self, samples: Vec<f32>) -> Vec<f32> {
        match self.stretch.as_mut() {
            Some(stretch) => stretch.push(&samples),
            None => samples,
        }
    }

    pub fn finish(&mut self) -> Vec<f32> {
        match self.stretch.as_mut() {
            Some(stretch) => stretch.finish(),
            None => Vec::new(),
        }
    }
}

impl Stretching {
    fn new(rate: u32, speed: f32, pitch: f32) -> Stretching {
        let mut stretch = Stretch::preset_default(1, rate);
        stretch.set_transpose_factor_semitones(pitch, None);
        let speed = speed as f64;
        let skip = (stretch.input_latency() as f64 / speed) as usize + stretch.output_latency();
        Stretching {
            stretch,
            speed,
            owed: 0.0,
            skip,
        }
    }

    fn push(&mut self, input: &[f32]) -> Vec<f32> {
        self.owed += input.len() as f64 / self.speed;
        let count = self.owed as usize;
        self.owed -= count as f64;
        let mut out = vec![0.0; count];
        self.stretch.process(input, &mut out);
        self.trimmed(out)
    }

    fn finish(&mut self) -> Vec<f32> {
        let silence = vec![0.0; self.stretch.input_latency()];
        let mut out = self.push(&silence);
        let mut tail = vec![0.0; self.stretch.output_latency()];
        self.stretch.flush(&mut tail);
        out.extend(self.trimmed(tail));
        out
    }

    fn trimmed(&mut self, mut out: Vec<f32>) -> Vec<f32> {
        let cut = self.skip.min(out.len());
        self.skip -= cut;
        out.drain(..cut);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 24000;

    fn burst() -> Vec<f32> {
        (0..RATE as usize * 2)
            .map(|i| {
                let loud = (12000..24000).contains(&i);
                let tone = (2.0 * std::f32::consts::PI * 220.0 * i as f32 / RATE as f32).sin();
                if loud { 0.5 * tone } else { 0.0 }
            })
            .collect()
    }

    fn shaped(speed: f32, pitch: f32, chunk: usize) -> Vec<f32> {
        let mut shaper = Shaper::new(RATE, speed, pitch);
        let mut out = Vec::new();
        for part in burst().chunks(chunk) {
            out.extend(shaper.push(part.to_vec()));
        }
        out.extend(shaper.finish());
        out
    }

    fn loud_span(samples: &[f32]) -> (usize, usize) {
        let first = samples.iter().position(|s| s.abs() > 0.2).unwrap();
        let last = samples.iter().rposition(|s| s.abs() > 0.2).unwrap();
        (first, last)
    }

    #[test]
    fn plain_settings_leave_the_audio_untouched() {
        assert_eq!(shaped(1.0, 0.0, 1000), burst());
    }

    #[test]
    fn faster_speech_is_shorter_and_stays_in_place() {
        let out = shaped(1.25, 0.0, 1920);
        let want = (burst().len() as f32 / 1.25) as i64;
        assert!(
            (out.len() as i64 - want).abs() < 50,
            "{} vs {want}",
            out.len()
        );
        let (first, last) = loud_span(&out);
        assert!((first as i64 - 9600).abs() < 600, "{first}");
        assert!((last as i64 - 19200).abs() < 600, "{last}");
    }

    #[test]
    fn a_pitch_shift_keeps_the_length_and_the_timing() {
        let out = shaped(1.0, 3.0, 700);
        assert!(
            (out.len() as i64 - burst().len() as i64).abs() < 50,
            "{}",
            out.len()
        );
        let (first, last) = loud_span(&out);
        assert!((first as i64 - 12000).abs() < 600, "{first}");
        assert!((last as i64 - 24000).abs() < 600, "{last}");
    }

    #[test]
    fn chunk_size_does_not_change_the_result_length() {
        assert_eq!(shaped(0.8, -2.0, 240).len(), shaped(0.8, -2.0, 4800).len());
    }
}
