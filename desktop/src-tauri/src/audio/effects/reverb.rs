const BASE_RATE: f32 = 44_100.0;
const COMBS: [usize; 8] = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES: [usize; 4] = [556, 441, 341, 225];
const SPREAD: usize = 23;
const INPUT_GAIN: f32 = 0.015;
const DAMP: f32 = 0.35;
const ALLPASS_FEEDBACK: f32 = 0.5;
const MIN_FEEDBACK: f32 = 0.7;
const FEEDBACK_SPAN: f32 = 0.28;
const FLUSH: f32 = 1e-15;

struct Comb {
    buf: Vec<f32>,
    pos: usize,
    store: f32,
}

struct Allpass {
    buf: Vec<f32>,
    pos: usize,
}

struct Bank {
    combs: Vec<Comb>,
    allpasses: Vec<Allpass>,
}

pub struct Reverb {
    banks: [Bank; 2],
    feedback: f32,
}

fn scaled(length: usize, spread: usize, sample_rate: f32) -> usize {
    (((length + spread) as f32 * sample_rate / BASE_RATE) as usize).max(2)
}

impl Bank {
    fn new(spread: usize, sample_rate: f32) -> Self {
        Self {
            combs: COMBS
                .iter()
                .map(|&length| Comb {
                    buf: vec![0.0; scaled(length, spread, sample_rate)],
                    pos: 0,
                    store: 0.0,
                })
                .collect(),
            allpasses: ALLPASSES
                .iter()
                .map(|&length| Allpass {
                    buf: vec![0.0; scaled(length, spread, sample_rate)],
                    pos: 0,
                })
                .collect(),
        }
    }

    fn process(&mut self, input: f32, feedback: f32) -> f32 {
        let mut sum = 0.0;
        for comb in &mut self.combs {
            let out = comb.buf[comb.pos];
            let store = out * (1.0 - DAMP) + comb.store * DAMP;
            comb.store = if store.abs() < FLUSH { 0.0 } else { store };
            comb.buf[comb.pos] = input + comb.store * feedback;
            comb.pos = (comb.pos + 1) % comb.buf.len();
            sum += out;
        }
        for allpass in &mut self.allpasses {
            let buffered = allpass.buf[allpass.pos];
            let out = buffered - sum;
            allpass.buf[allpass.pos] = sum + buffered * ALLPASS_FEEDBACK;
            allpass.pos = (allpass.pos + 1) % allpass.buf.len();
            sum = out;
        }
        sum
    }

    fn clear(&mut self) {
        for comb in &mut self.combs {
            comb.buf.fill(0.0);
            comb.store = 0.0;
        }
        for allpass in &mut self.allpasses {
            allpass.buf.fill(0.0);
        }
    }
}

impl Reverb {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            banks: [Bank::new(0, sample_rate), Bank::new(SPREAD, sample_rate)],
            feedback: MIN_FEEDBACK,
        }
    }

    pub fn set_room(&mut self, room: f32) {
        self.feedback = MIN_FEEDBACK + FEEDBACK_SPAN * room.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, left: f32, right: f32) -> (f32, f32) {
        let input = (left + right) * INPUT_GAIN;
        let wet_left = self.banks[0].process(input, self.feedback);
        let wet_right = self.banks[1].process(input, self.feedback);
        (wet_left, wet_right)
    }

    pub fn clear(&mut self) {
        for bank in &mut self.banks {
            bank.clear();
        }
    }
}
