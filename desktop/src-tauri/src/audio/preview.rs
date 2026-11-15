use std::sync::Arc;
use std::sync::atomic::AtomicU32;
use std::time::Duration;

use rodio::Player;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tokio::task;

use crate::audio::analyser::AnalyserBuffer;
use crate::audio::decode::create_player_from_bytes;
use crate::audio::effects::EffectsParams;
use crate::audio::state::AudioState;
use crate::audio::types::TICK_INTERVAL_MS;
use crate::rt::AppHandle;

const MIN_STEP: f32 = 0.0005;

#[derive(Default)]
pub struct PreviewState {
    player: Option<Player>,
    volume: f32,
    target: f32,
    step: f32,
    stop_at_zero: bool,
    outgoing: Option<Outgoing>,
    report: bool,
    ended: bool,
    r#gen: u64,
}

struct Outgoing {
    player: Player,
    volume: f32,
    step: f32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequest {
    path: String,
    volume: f64,
    r#gen: u64,
    #[serde(default)]
    start_ms: u64,
    #[serde(default)]
    fade_in_ms: u64,
    #[serde(default)]
    crossfade_ms: u64,
    #[serde(default)]
    report: bool,
}

#[derive(Clone, Serialize)]
struct PreviewTick {
    r#gen: u64,
    ms: u64,
}

fn step_for(volume: f32, fade_ms: u64) -> f32 {
    let ticks = (fade_ms as f32 / TICK_INTERVAL_MS as f32).max(1.0);
    (volume / ticks).max(MIN_STEP)
}

pub async fn play(request: PreviewRequest, state: State<'_, AudioState>) -> Result<u64, String> {
    if request.r#gen < state.preview.lock().unwrap().r#gen {
        return Ok(0);
    }
    let path = request.path.clone();
    let bytes = task::spawn_blocking(move || {
        std::fs::read(&path).map_err(|e| format!("Failed to read {path}: {e}"))
    })
    .await
    .map_err(|e| format!("preview read task failed: {e}"))??;

    let mixer = state.mixer.lock().unwrap().clone();
    let eq_params = state.eq_params.clone();
    let target = (request.volume as f32).clamp(0.0, 2.0);
    let fade_in_ms = request.fade_in_ms.max(request.crossfade_ms);
    let initial = if fade_in_ms > 0 { MIN_STEP } else { target };
    let start_ms = request.start_ms;
    let (player, started_ms) = task::spawn_blocking(move || {
        let (player, _) = create_player_from_bytes(
            &bytes,
            &mixer,
            initial,
            1.0,
            true,
            eq_params,
            AnalyserBuffer::new(),
            Arc::new(AtomicU32::new(1.0f32.to_bits())),
            Arc::new(EffectsParams::new()),
        )?;
        let started_ms = if start_ms > 0 && player.try_seek(Duration::from_millis(start_ms)).is_ok()
        {
            start_ms
        } else {
            0
        };
        Ok::<_, String>((player, started_ms))
    })
    .await
    .map_err(|e| format!("preview decode task failed: {e}"))??;

    let mut preview = state.preview.lock().unwrap();
    if request.r#gen < preview.r#gen {
        player.stop();
        return Ok(0);
    }
    player.play();
    if let Some(old) = preview.player.take() {
        retire(&mut preview, old, request.crossfade_ms);
    }
    preview.player = Some(player);
    preview.volume = initial;
    preview.target = target;
    preview.step = if fade_in_ms > 0 {
        step_for(target, fade_in_ms)
    } else {
        0.0
    };
    preview.stop_at_zero = false;
    preview.report = request.report;
    preview.ended = false;
    preview.r#gen = request.r#gen;
    Ok(started_ms)
}

fn retire(preview: &mut PreviewState, old: Player, crossfade_ms: u64) {
    if let Some(previous) = preview.outgoing.take() {
        previous.player.stop();
    }
    if crossfade_ms == 0 || preview.stop_at_zero {
        old.stop();
        return;
    }
    let volume = preview.volume;
    preview.outgoing = Some(Outgoing {
        player: old,
        volume,
        step: step_for(volume.max(MIN_STEP), crossfade_ms),
    });
}

pub fn stop(fade_ms: u64, r#gen: u64, state: State<'_, AudioState>) {
    let mut preview = state.preview.lock().unwrap();
    if r#gen != 0 && r#gen != preview.r#gen {
        return;
    }
    preview.report = false;
    if fade_ms == 0 {
        if let Some(old) = preview.player.take() {
            old.stop();
        }
        if let Some(outgoing) = preview.outgoing.take() {
            outgoing.player.stop();
        }
        preview.volume = 0.0;
        preview.target = 0.0;
        preview.step = 0.0;
        preview.stop_at_zero = false;
        return;
    }
    if preview.player.is_none() {
        return;
    }
    preview.step = step_for(preview.volume.max(MIN_STEP), fade_ms);
    preview.target = 0.0;
    preview.stop_at_zero = true;
}

pub fn pause(paused: bool, r#gen: u64, state: State<'_, AudioState>) {
    let preview = state.preview.lock().unwrap();
    if r#gen != preview.r#gen {
        return;
    }
    if let Some(ref player) = preview.player {
        if paused {
            player.pause();
        } else {
            player.play();
        }
    }
}

pub fn set_volume(volume: f64, state: State<'_, AudioState>) {
    let mut preview = state.preview.lock().unwrap();
    if preview.stop_at_zero || preview.player.is_none() {
        return;
    }
    let target = (volume as f32).clamp(0.0, 2.0);
    preview.target = target;
    if preview.step == 0.0 || (preview.volume - target).abs() <= f32::EPSILON {
        preview.volume = target;
        if let Some(ref player) = preview.player {
            player.set_volume(target);
        }
    }
}

pub fn tick(app: &AppHandle, state: &AudioState) {
    let (report, ended) = {
        let mut preview = state.preview.lock().unwrap();
        fade_outgoing(&mut preview);
        fade_current(&mut preview);
        progress(&mut preview)
    };
    if let Some(tick) = report {
        app.emit("audio:preview-tick", tick).ok();
    }
    if let Some(r#gen) = ended {
        app.emit("audio:preview-ended", r#gen).ok();
    }
}

fn fade_outgoing(preview: &mut PreviewState) {
    let Some(outgoing) = preview.outgoing.as_mut() else {
        return;
    };
    outgoing.volume = (outgoing.volume - outgoing.step).max(0.0);
    outgoing.player.set_volume(outgoing.volume);
    if outgoing.volume <= 0.0
        && let Some(done) = preview.outgoing.take()
    {
        done.player.stop();
    }
}

fn fade_current(preview: &mut PreviewState) {
    if preview.player.is_none() || (preview.volume - preview.target).abs() <= f32::EPSILON {
        return;
    }
    let next = if preview.volume < preview.target {
        (preview.volume + preview.step).min(preview.target)
    } else {
        (preview.volume - preview.step).max(preview.target)
    };
    preview.volume = next;
    if let Some(ref player) = preview.player {
        player.set_volume(next);
    }
    if preview.stop_at_zero
        && next <= 0.0
        && let Some(old) = preview.player.take()
    {
        old.stop();
    }
}

fn progress(preview: &mut PreviewState) -> (Option<PreviewTick>, Option<u64>) {
    if !preview.report {
        return (None, None);
    }
    let Some(ref player) = preview.player else {
        return (None, None);
    };
    let r#gen = preview.r#gen;
    if player.empty() {
        if preview.ended {
            return (None, None);
        }
        preview.ended = true;
        return (None, Some(r#gen));
    }
    if player.is_paused() {
        return (None, None);
    }
    let ms = player.get_pos().as_millis() as u64;
    (Some(PreviewTick { r#gen, ms }), None)
}
