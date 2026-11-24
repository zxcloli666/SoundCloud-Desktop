use std::f32::consts::FRAC_PI_2;
use std::time::Duration;

use rodio::Player;
use serde::Deserialize;
use tauri::Manager;

use crate::audio::state::AudioState;
use crate::rt::AppHandle;

const STEP: Duration = Duration::from_millis(20);
pub const MAX_LENGTH: Duration = Duration::from_secs(12);

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Curve {
    EqualPower,
    Linear,
    Smooth,
}

#[derive(Clone, Copy, Deserialize)]
pub struct Crossfade {
    ms: u64,
    curve: Curve,
}

struct Fade {
    outgoing: Player,
    curve: Curve,
    length: f32,
    elapsed: f32,
    r#gen: u64,
}

#[derive(Default)]
pub struct CrossfadeState {
    fade: Option<Fade>,
    r#gen: u64,
}

impl Curve {
    fn gains(self, progress: f32) -> (f32, f32) {
        let progress = progress.clamp(0.0, 1.0);
        (self.rise(1.0 - progress), self.rise(progress))
    }

    fn rise(self, progress: f32) -> f32 {
        match self {
            Self::EqualPower => (progress * FRAC_PI_2).sin(),
            Self::Linear => progress,
            Self::Smooth => progress * progress * (3.0 - 2.0 * progress),
        }
    }
}

impl Fade {
    fn gains(&self) -> (f32, f32) {
        self.curve.gains(self.elapsed / self.length)
    }
}

pub fn incoming_gain(state: &AudioState) -> f32 {
    state
        .crossfade
        .lock()
        .unwrap()
        .fade
        .as_ref()
        .map_or(1.0, |fade| fade.gains().1)
}

pub fn begin(app: &AppHandle, state: &AudioState, outgoing: Player, crossfade: Crossfade) {
    let length = Duration::from_millis(crossfade.ms)
        .clamp(STEP, MAX_LENGTH)
        .as_secs_f32();
    let r#gen = {
        let mut slot = state.crossfade.lock().unwrap();
        if let Some(previous) = slot.fade.take() {
            previous.outgoing.stop();
        }
        slot.r#gen += 1;
        slot.fade = Some(Fade {
            outgoing,
            curve: crossfade.curve,
            length,
            elapsed: 0.0,
            r#gen: slot.r#gen,
        });
        slot.r#gen
    };
    let app = app.clone();
    std::thread::Builder::new()
        .name("audio-crossfade".into())
        .spawn(move || {
            while advance(&app.state::<AudioState>(), r#gen) {
                std::thread::sleep(STEP);
            }
        })
        .ok();
}

pub fn finish(state: &AudioState) {
    let mut slot = state.crossfade.lock().unwrap();
    let Some(fade) = slot.fade.take() else {
        return;
    };
    fade.outgoing.stop();
    let volume = *state.volume.lock().unwrap();
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.set_volume(volume);
    }
}

pub fn set_paused(state: &AudioState, paused: bool) {
    if let Some(fade) = state.crossfade.lock().unwrap().fade.as_ref() {
        if paused {
            fade.outgoing.pause();
        } else {
            fade.outgoing.play();
        }
    }
}

fn advance(state: &AudioState, r#gen: u64) -> bool {
    let paused = state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .is_none_or(|player| player.is_paused());
    let volume = *state.volume.lock().unwrap();
    let mut slot = state.crossfade.lock().unwrap();
    let Some(fade) = slot.fade.as_mut().filter(|fade| fade.r#gen == r#gen) else {
        return false;
    };
    if !paused {
        fade.elapsed = (fade.elapsed + STEP.as_secs_f32()).min(fade.length);
    }
    let (out_gain, in_gain) = fade.gains();
    fade.outgoing.set_volume(volume * out_gain);
    let done = fade.elapsed >= fade.length;
    if done && let Some(fade) = slot.fade.take() {
        fade.outgoing.stop();
    }
    if let Some(player) = state.player.lock().unwrap().as_ref() {
        player.set_volume(volume * in_gain);
    }
    !done
}

#[cfg(test)]
mod tests {
    use super::*;

    const CURVES: [Curve; 3] = [Curve::EqualPower, Curve::Linear, Curve::Smooth];

    fn steps() -> impl Iterator<Item = f32> {
        (0..=20).map(|step| step as f32 / 20.0)
    }

    #[test]
    fn every_curve_goes_from_the_outgoing_track_to_the_incoming_one() {
        for curve in CURVES {
            assert_eq!(curve.gains(0.0), (1.0, 0.0));
            assert_eq!(curve.gains(1.0), (0.0, 1.0));
        }
    }

    #[test]
    fn every_curve_is_monotonic() {
        for curve in CURVES {
            for (from, to) in steps().zip(steps().skip(1)) {
                let (before, after) = (curve.gains(from), curve.gains(to));
                assert!(after.0 < before.0);
                assert!(after.1 > before.1);
            }
        }
    }

    #[test]
    fn every_curve_clamps_out_of_range_progress() {
        for curve in CURVES {
            assert_eq!(curve.gains(-1.0), curve.gains(0.0));
            assert_eq!(curve.gains(2.0), curve.gains(1.0));
        }
    }

    #[test]
    fn equal_power_keeps_constant_power() {
        for progress in steps() {
            let (out_gain, in_gain) = Curve::EqualPower.gains(progress);
            assert!((out_gain * out_gain + in_gain * in_gain - 1.0).abs() < 1e-5);
        }
    }

    #[test]
    fn linear_and_smooth_keep_constant_amplitude() {
        for curve in [Curve::Linear, Curve::Smooth] {
            for progress in steps() {
                let (out_gain, in_gain) = curve.gains(progress);
                assert!((out_gain + in_gain - 1.0).abs() < 1e-5);
            }
        }
    }

    #[test]
    fn smooth_starts_and_ends_flat() {
        assert!(Curve::Smooth.gains(0.05).1 < Curve::Linear.gains(0.05).1);
        assert!(Curve::Smooth.gains(0.95).1 > Curve::Linear.gains(0.95).1);
    }

    #[test]
    fn crossfade_comes_from_the_frontend_json() {
        let crossfade: Crossfade = serde_json::from_str(r#"{"ms":4000,"curve":"smooth"}"#).unwrap();
        assert_eq!(crossfade.ms, 4000);
        assert!(matches!(crossfade.curve, Curve::Smooth));
    }
}
