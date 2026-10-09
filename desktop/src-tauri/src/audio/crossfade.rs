use std::f32::consts::FRAC_PI_2;
use std::time::Duration;

use rodio::Player;
use tauri::Manager;

use crate::audio::state::AudioState;
use crate::rt::AppHandle;

const STEP: Duration = Duration::from_millis(20);
pub const MAX_LENGTH: Duration = Duration::from_secs(12);

struct Fade {
    outgoing: Player,
    length: f32,
    elapsed: f32,
    r#gen: u64,
}

#[derive(Default)]
pub struct CrossfadeState {
    fade: Option<Fade>,
    r#gen: u64,
}

pub fn gains(progress: f32) -> (f32, f32) {
    let angle = progress.clamp(0.0, 1.0) * FRAC_PI_2;
    (angle.cos(), angle.sin())
}

pub fn incoming_gain(state: &AudioState) -> f32 {
    state
        .crossfade
        .lock()
        .unwrap()
        .fade
        .as_ref()
        .map_or(1.0, |fade| gains(fade.elapsed / fade.length).1)
}

pub fn begin(app: &AppHandle, state: &AudioState, outgoing: Player, length: Duration) {
    let length = length.min(MAX_LENGTH).as_secs_f32().max(STEP.as_secs_f32());
    let r#gen = {
        let mut slot = state.crossfade.lock().unwrap();
        if let Some(previous) = slot.fade.take() {
            previous.outgoing.stop();
        }
        slot.r#gen += 1;
        slot.fade = Some(Fade {
            outgoing,
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
    let (out_gain, in_gain) = gains(fade.elapsed / fade.length);
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

    #[test]
    fn gains_start_on_the_outgoing_track() {
        assert_eq!(gains(0.0), (1.0, 0.0));
    }

    #[test]
    fn gains_end_on_the_incoming_track() {
        let (out_gain, in_gain) = gains(1.0);
        assert!(out_gain.abs() < 1e-6);
        assert!((in_gain - 1.0).abs() < 1e-6);
    }

    #[test]
    fn gains_keep_constant_power() {
        for step in 0..=20 {
            let (out_gain, in_gain) = gains(step as f32 / 20.0);
            assert!((out_gain * out_gain + in_gain * in_gain - 1.0).abs() < 1e-5);
        }
    }

    #[test]
    fn gains_clamp_out_of_range_progress() {
        assert_eq!(gains(-1.0), gains(0.0));
        assert_eq!(gains(2.0), gains(1.0));
    }
}
