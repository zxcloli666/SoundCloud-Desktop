use std::sync::atomic::Ordering;
use std::time::Duration;

use crate::rt::AppHandle;
use tauri::{Emitter, Manager};

use crate::app::{diagnostics, visibility};
use crate::audio::engine;
use crate::audio::silence::SilenceJump;
use crate::audio::state::AudioState;
use crate::audio::timing;
use crate::audio::types::{
    AudioThreadCmd, HIDDEN_TICK_INTERVAL, STALL_COOLDOWN_MS, STALL_THRESHOLD_MS,
    TICK_INTERVAL_MS,
};
#[cfg(target_os = "linux")]
use crate::audio::types::MediaCmd;

#[cfg(target_os = "linux")]
const MEDIA_SYNC_INTERVAL: Duration = Duration::from_secs(2);

#[cfg(target_os = "linux")]
fn push_media_position(state: &AudioState, position: f64) {
    if let Some(tx) = state.media_tx.lock().unwrap().as_ref() {
        tx.send(MediaCmd::SetPosition(position)).ok();
    }
}

/// Step the hover-preview volume one tick toward its target, dropping the player
/// once a fade-out reaches zero. Independent of the main player.
fn process_preview_fade(state: &AudioState) {
    let mut preview = state.preview.lock().unwrap();
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
    if preview.stop_at_zero && next <= 0.0
        && let Some(old) = preview.player.take() {
            old.stop();
        }
}

pub fn start_tick_emitter(app: &AppHandle) {
    let handle = app.clone();
    std::thread::Builder::new()
        .name("audio-tick".into())
        .spawn(move || {
            let mut last_pos_ms = 0u64;
            let mut last_progress_at = std::time::Instant::now();
            let mut stall_cooldown_until = std::time::Instant::now();
            let mut last_tick_emit = std::time::Instant::now();
            #[cfg(target_os = "linux")]
            let mut last_media_sync = std::time::Instant::now();
            #[cfg(target_os = "linux")]
            let mut media_sync_load_gen = 0;

            loop {
                std::thread::sleep(Duration::from_millis(TICK_INTERVAL_MS));
                let state = handle.state::<AudioState>();

                if state.device_reconnected.swap(false, Ordering::Acquire) {
                    let _ = engine::reload_current_track(&state);
                    diagnostics::log_native(
                        &handle,
                        "INFO",
                        "[Audio] Device reconnected and reloaded",
                    );
                    handle.emit("audio:device-reconnected", ()).ok();
                }

                // Advance the hover-preview volume ramp. Done before the has_track
                // guard so previews fade in/out even when no main track is loaded.
                process_preview_fade(&state);

                if !state.has_track.load(Ordering::Relaxed) {
                    last_pos_ms = 0;
                    last_progress_at = std::time::Instant::now();
                    continue;
                }

                let player_guard = state.player.lock().unwrap();
                if let Some(ref player) = *player_guard {
                    if player.empty() {
                        let suppress_ended = super::engine::now_ms()
                            < state.suppress_ended_until_ms.load(Ordering::Relaxed);
                        if !state.device_error.load(Ordering::Relaxed)
                            && !suppress_ended
                            && !state.ended_notified.swap(true, Ordering::Relaxed)
                        {
                            handle.emit("audio:ended", ()).ok();
                        }
                    } else {
                        // rodio's get_pos() is output (wall-clock) time; the rest of the
                        // app works in source seconds, so integrate (exact across speed
                        // changes — see engine::source_pos).
                        let rate = engine::current_rate(&state);
                        let raw = player.get_pos().as_secs_f64();
                        let pos = engine::source_pos(&state, player);

                        // A-B loop: snap back to A as soon as we cross B (source secs).
                        // Route through engine::seek_to (in-place try_seek with a
                        // recreate fallback), NOT a bare try_seek: on decoders that
                        // can't seek in place a bare try_seek silently no-ops, leaving
                        // the segment playing straight through while the bar froze at A.
                        let ab = *state.ab_loop.lock().unwrap();
                        let jump_target = match ab {
                            Some((a, b)) => (pos >= b).then_some(a),
                            None if player.is_paused() => None,
                            None => match state.silence.lock().unwrap().jump(pos) {
                                Some(SilenceJump::To(target)) => Some(target),
                                Some(SilenceJump::End) => {
                                    player.stop();
                                    state.ended_notified.store(true, Ordering::Relaxed);
                                    handle.emit("audio:ended", true).ok();
                                    continue;
                                }
                                None => None,
                            },
                        };
                        if let Some(target) = jump_target {
                            drop(player_guard);
                            engine::seek_to(&state, target).ok();
                            #[cfg(target_os = "linux")]
                            {
                                push_media_position(&state, target);
                                last_media_sync = std::time::Instant::now();
                            }
                            handle.emit("audio:tick", target).ok();
                            last_pos_ms = ((target / rate).max(0.0) * 1000.0) as u64;
                            last_progress_at = std::time::Instant::now();
                            continue;
                        }

                        if !visibility::pages_hidden()
                            || last_tick_emit.elapsed() >= HIDDEN_TICK_INTERVAL
                        {
                            handle.emit("audio:tick", pos).ok();
                            last_tick_emit = std::time::Instant::now();
                        }
                        timing::process_lyrics_timeline(&handle, &state, pos);
                        timing::process_comments_timeline(&handle, &state, pos);

                        let playing = !player.is_paused();
                        let pos_ms = (raw * 1000.0) as u64;
                        let now = std::time::Instant::now();

                        #[cfg(target_os = "linux")]
                        {
                            let load_gen = state.load_gen.load(Ordering::Relaxed);
                            if load_gen != media_sync_load_gen {
                                media_sync_load_gen = load_gen;
                                last_media_sync = now;
                            } else if playing
                                && now.duration_since(last_media_sync) >= MEDIA_SYNC_INTERVAL
                            {
                                push_media_position(&state, pos);
                                last_media_sync = now;
                            }
                        }

                        if !playing {
                            last_pos_ms = pos_ms;
                            last_progress_at = now;
                            continue;
                        }

                        if pos_ms > last_pos_ms {
                            last_pos_ms = pos_ms;
                            last_progress_at = now;
                            continue;
                        }

                        // Backward seek detected — reset stall tracking
                        if pos_ms < last_pos_ms.saturating_sub(500) {
                            last_pos_ms = pos_ms;
                            last_progress_at = now;
                            continue;
                        }

                        // Don't mistake a settling device switch/reconnect for a stall:
                        // the freshly opened output may not be pulling samples yet.
                        if super::engine::now_ms()
                            < state.suppress_stall_until_ms.load(Ordering::Relaxed)
                        {
                            last_progress_at = now;
                            continue;
                        }

                        if now < stall_cooldown_until {
                            continue;
                        }

                        if now.duration_since(last_progress_at).as_millis() as u64
                            > STALL_THRESHOLD_MS
                        {
                            drop(player_guard);
                            diagnostics::log_native(
                                &handle,
                                "WARN",
                                "[Audio] Stall detected, reconnecting audio device",
                            );
                            // Reconnect device — stall often means the audio stream
                            // died silently (macOS sleep/wake, headphone unplug).
                            // Just reloading the track on a dead mixer won't help.
                            state.audio_tx.send(AudioThreadCmd::Reconnect).ok();
                            stall_cooldown_until = std::time::Instant::now()
                                + Duration::from_millis(STALL_COOLDOWN_MS);
                            last_progress_at = std::time::Instant::now();
                        }
                    }
                }
            }
        })
        .expect("failed to spawn tick thread");
}
