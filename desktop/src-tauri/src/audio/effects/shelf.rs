use std::f64::consts::TAU;

const CORNER_HZ: f64 = 100.0;

#[derive(Clone, Copy)]
struct Coefficients {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
}

pub struct LowShelf {
    coefficients: Coefficients,
    z1: f64,
    z2: f64,
}

fn design(gain_db: f64, sample_rate: f64) -> Coefficients {
    let a = 10f64.powf(gain_db / 40.0);
    let w = TAU * CORNER_HZ / sample_rate;
    let (sin, cos) = w.sin_cos();
    let alpha = sin / 2.0 * 2f64.sqrt();
    let beta = 2.0 * a.sqrt() * alpha;
    let a0 = (a + 1.0) + (a - 1.0) * cos + beta;
    Coefficients {
        b0: a * ((a + 1.0) - (a - 1.0) * cos + beta) / a0,
        b1: 2.0 * a * ((a - 1.0) - (a + 1.0) * cos) / a0,
        b2: a * ((a + 1.0) - (a - 1.0) * cos - beta) / a0,
        a1: -2.0 * ((a - 1.0) + (a + 1.0) * cos) / a0,
        a2: ((a + 1.0) + (a - 1.0) * cos - beta) / a0,
    }
}

impl LowShelf {
    pub fn new(sample_rate: f64) -> Self {
        Self {
            coefficients: design(0.0, sample_rate),
            z1: 0.0,
            z2: 0.0,
        }
    }

    pub fn set_gain(&mut self, gain_db: f64, sample_rate: f64) {
        self.coefficients = design(gain_db, sample_rate);
    }

    pub fn run(&mut self, input: f32) -> f32 {
        let c = self.coefficients;
        let x = input as f64;
        let y = c.b0 * x + self.z1;
        self.z1 = c.b1 * x - c.a1 * y + self.z2;
        self.z2 = c.b2 * x - c.a2 * y;
        y as f32
    }

    pub fn clear(&mut self) {
        self.z1 = 0.0;
        self.z2 = 0.0;
    }
}
