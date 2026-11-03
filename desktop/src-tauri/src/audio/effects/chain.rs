use std::sync::Arc;

use super::limiter::Limiter;
use super::pan::HeadPan;
use super::params::{EffectsParams, Targets};
use super::reverb::Reverb;
use super::shelf::LowShelf;

const CONTROL_FRAMES: u32 = 32;
const GLIDE_SECS: f32 = 0.015;
const SNAP: f32 = 1e-4;
const DRY_DUCK: f32 = 0.4;
const WET_GAIN: f32 = 3.0;

const REVERB: u8 = 1;
const PAN: u8 = 2;
const BASS: u8 = 4;

pub struct Chain {
    params: Arc<EffectsParams>,
    sample_rate: f32,
    glide: f32,
    tick: u32,
    active: u8,
    targets: Targets,
    reverb_mix: f32,
    room: f32,
    pan_depth: f32,
    pan_hz: f32,
    bass_db: f32,
    phase: f32,
    shelf: [LowShelf; 2],
    head: HeadPan,
    reverb: Reverb,
    limiter: Limiter,
}

fn approach(value: &mut f32, target: f32, glide: f32) {
    *value += (target - *value) * glide;
    if (*value - target).abs() < SNAP {
        *value = target;
    }
}

impl Chain {
    pub fn new(params: Arc<EffectsParams>, sample_rate: u32) -> Self {
        let rate = sample_rate as f32;
        let targets = params.targets();
        Self {
            params,
            sample_rate: rate,
            glide: 1.0 - (-1.0 / (GLIDE_SECS * rate)).exp(),
            tick: 0,
            active: 0,
            targets,
            reverb_mix: targets.reverb,
            room: targets.room,
            pan_depth: targets.pan,
            pan_hz: targets.pan_hz,
            bass_db: targets.bass_db,
            phase: 0.0,
            shelf: [LowShelf::new(rate as f64), LowShelf::new(rate as f64)],
            head: HeadPan::new(),
            reverb: Reverb::new(rate),
            limiter: Limiter::new(rate),
        }
    }

    pub fn frame(&mut self, left: f32, right: f32) -> (f32, f32) {
        if self.tick % CONTROL_FRAMES == 0 {
            self.targets = self.params.targets();
            self.tune();
        }
        self.tick = self.tick.wrapping_add(1);
        self.glide_values();

        let active = self.active_stages();
        if active != self.active {
            self.active = active;
            self.clear_idle_stages();
            self.tune();
        }
        if active == 0 {
            return (left, right);
        }
        self.render(left, right, active)
    }

    fn render(&mut self, mut left: f32, mut right: f32, active: u8) -> (f32, f32) {
        if active & BASS != 0 {
            left = self.shelf[0].run(left);
            right = self.shelf[1].run(right);
        }
        if active & PAN != 0 {
            self.phase += self.pan_hz / self.sample_rate;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
            (left, right) = self.head.process(left, right);
        }
        if active & REVERB != 0 {
            let (wet_left, wet_right) = self.reverb.process(left, right);
            let dry = 1.0 - DRY_DUCK * self.reverb_mix;
            let wet = self.reverb_mix * WET_GAIN;
            left = left * dry + wet_left * wet;
            right = right * dry + wet_right * wet;
        }
        self.limiter.process(left, right)
    }

    fn tune(&mut self) {
        if self.active & BASS != 0 {
            for shelf in &mut self.shelf {
                shelf.set_gain(self.bass_db as f64, self.sample_rate as f64);
            }
        }
        if self.active & PAN != 0 {
            let position = (self.phase * std::f32::consts::TAU).sin();
            self.head.aim(position, self.pan_depth, self.sample_rate);
        }
        if self.active & REVERB != 0 {
            self.reverb.set_room(self.room);
        }
    }

    fn glide_values(&mut self) {
        let glide = self.glide;
        let targets = self.targets;
        approach(&mut self.reverb_mix, targets.reverb, glide);
        approach(&mut self.room, targets.room, glide);
        approach(&mut self.pan_depth, targets.pan, glide);
        approach(&mut self.pan_hz, targets.pan_hz, glide);
        approach(&mut self.bass_db, targets.bass_db, glide);
    }

    fn active_stages(&self) -> u8 {
        let reverb = (self.reverb_mix > 0.0) as u8 * REVERB;
        let pan = (self.pan_depth > 0.0) as u8 * PAN;
        let bass = (self.bass_db > 0.0) as u8 * BASS;
        reverb | pan | bass
    }

    fn clear_idle_stages(&mut self) {
        if self.active & REVERB == 0 {
            self.reverb.clear();
        }
        if self.active & PAN == 0 {
            self.head.clear();
        }
        if self.active & BASS == 0 {
            self.shelf.iter_mut().for_each(LowShelf::clear);
        }
    }

    pub fn reset(&mut self) {
        self.reverb.clear();
        self.head.clear();
        self.limiter.clear();
        self.shelf.iter_mut().for_each(LowShelf::clear);
    }
}
