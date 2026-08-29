use std::sync::atomic::Ordering;
use std::time::Duration;

use crate::rt::AppHandle;
use tauri::{Emitter, Manager};

use crate::app::diagnostics;
use crate::audio::engine;
use crate::audio::state::AudioState;
use crate::audio::timing;
use crate::audio::types::{
    AudioThreadCmd, STALL_COOLDOWN_MS, STALL_THRESHOLD_MS, TICK_INTERVAL_MS,
};

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
            let mut last_emitted_source_ms: Option<u64> = None;
            let mut last_progress_at = std::time::Instant::now();
            let mut stall_cooldown_until = std::time::Instant::now();

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
                    last_emitted_source_ms = None;
                    last_progress_at = std::time::Instant::now();
                    continue;
                }

                let player_guard = state.player.lock().unwrap();
                if let Some(ref player) = *player_guard {
                    if player.empty() {
                        let suppress_ended = super::engine::now_ms()
                            < state.suppress_ended_until_ms.load(Ordering::Relaxed);
                        if suppress_ended {
                            continue;
                        }

                        // Hold no blocking lock in the reverse of engine's
                        // active_stream -> player order. While a completed stream
                        // is being committed, wait for it to clear instead of
                        // briefly misclassifying it as a natural end.
                        let stream_error = match state.active_stream.try_lock() {
                            Ok(stream) => match stream.as_ref() {
                                Some(active) => {
                                    let error = active.terminal_error();
                                    if error.is_none() {
                                        continue;
                                    }
                                    error
                                }
                                None => None,
                            },
                            Err(_) => continue,
                        };

                        if let Some(error) = stream_error {
                            if !state.ended_notified.swap(true, Ordering::Relaxed) {
                                handle.emit("audio:stream-error", error).ok();
                            }
                            continue;
                        }

                        if !state.device_error.load(Ordering::Relaxed)
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
                        if let Some((a, b)) = ab
                            && pos >= b {
                                drop(player_guard);
                                engine::seek_to(&state, a).ok();
                                handle.emit("audio:tick", a).ok();
                                last_emitted_source_ms = Some((a.max(0.0) * 1000.0) as u64);
                                last_pos_ms = ((a / rate).max(0.0) * 1000.0) as u64;
                                last_progress_at = std::time::Instant::now();
                                continue;
                            }

                        // A paused rodio player reports the same position forever. Avoid
                        // pushing an identical global Tauri event 10 times per second;
                        // the tray and every frontend audio subscriber otherwise wake up
                        // for a frame that cannot change. A seek still emits immediately
                        // because its source position differs at millisecond precision.
                        let source_pos_ms = (pos.max(0.0) * 1000.0) as u64;
                        if last_emitted_source_ms != Some(source_pos_ms) {
                            handle.emit("audio:tick", pos).ok();
                            last_emitted_source_ms = Some(source_pos_ms);
                        }
                        timing::process_lyrics_timeline(&handle, &state, pos);
                        timing::process_comments_timeline(&handle, &state, pos);

                        let playing = !player.is_paused();
                        let pos_ms = (raw * 1000.0) as u64;
                        let now = std::time::Instant::now();

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

                        // A progressive decoder may legitimately wait while the
                        // network buffer grows. Reconnecting the output device in
                        // that state restarts a healthy player and can look like a
                        // track switch. Device-stall recovery resumes once the
                        // producer commits the complete source and clears it.
                        let (stream_is_growing, stream_error) =
                            match state.active_stream.try_lock() {
                                Ok(stream) => stream
                                    .as_ref()
                                    .map(|active| (active.is_growing(), active.terminal_error()))
                                    .unwrap_or((false, None)),
                                Err(_) => continue,
                            };
                        if stream_is_growing {
                            last_progress_at = now;
                            continue;
                        }

                        if now.duration_since(last_progress_at).as_millis() as u64
                            > STALL_THRESHOLD_MS
                        {
                            if let Some(error) = stream_error {
                                if !state.ended_notified.swap(true, Ordering::Relaxed) {
                                    handle.emit("audio:stream-error", error).ok();
                                }
                                continue;
                            }
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
