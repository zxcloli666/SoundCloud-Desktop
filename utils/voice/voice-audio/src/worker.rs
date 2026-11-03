use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender};
use std::time::Duration;

use crate::aec::Aec;
use crate::capture::Event;
use crate::device::Device;
use crate::frames::{FRAME, Frame, Framer, energy};
use crate::ref_sync::RefSync;
use crate::routing::Purpose;
use crate::select::Selector;
use crate::source::Msg;
use crate::tap::RefTap;

const LEVEL_FRAMES: u32 = 3;

pub struct Lane {
    source_index: usize,
    device: Device,
    framer: Option<(u32, Framer)>,
    aec: Option<Aec>,
    refsync: RefSync,
    level_energy: f32,
    level_frames: u32,
    alive: bool,
}

impl Lane {
    pub fn new(source_index: usize, device: Device, aec: Option<Aec>, refsync: RefSync) -> Self {
        Self {
            source_index,
            device,
            framer: None,
            aec,
            refsync,
            level_energy: 0.0,
            level_frames: 0,
            alive: true,
        }
    }

    fn process(
        &mut self,
        samples: &[f32],
        rate: u32,
        meter_only: bool,
        events: &Sender<Event>,
    ) -> Option<Vec<Frame>> {
        if self.framer.as_ref().is_none_or(|(r, _)| *r != rate) {
            self.framer = Some((rate, Framer::new(rate).ok()?));
        }
        let frames = self.framer.as_mut()?.1.push(samples);
        let mut cleaned = Vec::with_capacity(frames.len());
        for frame in frames {
            if !self.level(&frame, events) {
                return None;
            }
            if !meter_only {
                cleaned.push(self.clean(&frame));
            }
        }
        Some(cleaned)
    }

    fn clean(&mut self, frame: &Frame) -> Frame {
        let Some(aec) = self.aec.as_mut() else {
            return *frame;
        };
        let mut reference = [0.0; FRAME];
        self.refsync.pull(&mut reference);
        let mut out = [0.0; FRAME];
        if aec.render(&reference).is_err() || aec.capture(frame, &mut out).is_err() {
            return *frame;
        }
        out
    }

    fn level(&mut self, frame: &Frame, events: &Sender<Event>) -> bool {
        self.level_energy += energy(frame);
        self.level_frames += 1;
        if self.level_frames < LEVEL_FRAMES {
            return true;
        }
        let rms = (self.level_energy / self.level_frames as f32).sqrt();
        self.level_energy = 0.0;
        self.level_frames = 0;
        let level = Event::Level {
            input: self.device.id.clone(),
            rms,
        };
        events.send(level).is_ok()
    }
}

pub fn run(
    rx: Receiver<Msg>,
    events: Sender<Event>,
    mut lanes: Vec<Lane>,
    purpose: Purpose,
    tap: &RefTap,
    stop: &Arc<AtomicBool>,
) {
    let mut selector =
        (lanes.len() > 1 && purpose != Purpose::Meter).then(|| Selector::new(lanes.len()));
    let mut ref_framer: Option<(u32, Framer)> = None;
    let mut announced: Option<usize> = None;
    let mut ref_native: Vec<f32> = Vec::with_capacity(16_384);

    while !stop.load(Ordering::Relaxed) {
        let msg = match rx.recv_timeout(Duration::from_millis(50)) {
            Ok(msg) => msg,
            Err(RecvTimeoutError::Timeout) => continue,
            Err(RecvTimeoutError::Disconnected) => break,
        };
        match msg {
            Msg::Lost { input, error } => {
                let Some(idx) = lanes
                    .iter()
                    .position(|l| l.source_index == input && l.alive)
                else {
                    continue;
                };
                lanes[idx].alive = false;
                if let Some(sel) = selector.as_mut() {
                    sel.drop_input(idx);
                }
                let error = error.for_input(&lanes[idx].device.id);
                if events.send(Event::Error(error)).is_err() || lanes.iter().all(|l| !l.alive) {
                    break;
                }
            }
            Msg::Chunk {
                input,
                samples,
                rate,
            } => {
                feed_reference(tap, &mut ref_framer, &mut ref_native, &mut lanes);
                let Some(idx) = lanes
                    .iter()
                    .position(|l| l.source_index == input && l.alive)
                else {
                    continue;
                };
                let meter_only = purpose == Purpose::Meter;
                let Some(cleaned) = lanes[idx].process(&samples, rate, meter_only, &events) else {
                    return;
                };
                for frame in cleaned {
                    let emitted = match selector.as_mut() {
                        Some(sel) => sel.push(idx, frame),
                        None => vec![(idx, frame)],
                    };
                    let locked = selector.as_ref().and_then(|s| s.locked());
                    if locked != announced {
                        announced = locked;
                        if let Some(winner) = locked {
                            let input = lanes[winner].device.id.clone();
                            if events.send(Event::Selected { input }).is_err() {
                                return;
                            }
                        }
                    }
                    for (slot, out) in emitted {
                        let event = Event::Frame {
                            input: lanes[slot].device.id.clone(),
                            samples: out.to_vec(),
                        };
                        if events.send(event).is_err() {
                            return;
                        }
                    }
                }
            }
        }
    }
}

fn feed_reference(
    tap: &RefTap,
    framer: &mut Option<(u32, Framer)>,
    native: &mut Vec<f32>,
    lanes: &mut [Lane],
) {
    if lanes.iter().all(|l| l.aec.is_none()) {
        return;
    }
    let rate = tap.take(native);
    if native.is_empty() || rate == 0 {
        return;
    }
    if framer.as_ref().is_none_or(|(r, _)| *r != rate) {
        match Framer::new(rate) {
            Ok(new) => *framer = Some((rate, new)),
            Err(_) => return,
        }
    }
    let Some((_, framer)) = framer.as_mut() else {
        return;
    };
    let frames = framer.push(native);
    for lane in lanes.iter_mut().filter(|l| l.aec.is_some()) {
        for frame in &frames {
            lane.refsync.push(frame);
        }
    }
}
