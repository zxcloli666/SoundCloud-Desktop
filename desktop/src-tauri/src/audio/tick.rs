use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::app::diagnostics;
use crate::audio::engine;
use crate::audio::state::AudioState;
use crate::audio::timing;
use crate::audio::types::{STALL_COOLDOWN_MS, STALL_THRESHOLD_MS, TICK_INTERVAL_MS};

pub fn start_tick_emitter(app: &AppHandle) {
    let handle = app.clone();
    std::thread::Builder::new()
        .name("audio-tick".into())
        .spawn(move || loop {
            let mut last_pos_ms = 0u64;
            let mut last_progress_at = std::time::Instant::now();
            let mut stall_cooldown_until = std::time::Instant::now();

            loop {
                std::thread::sleep(Duration::from_millis(TICK_INTERVAL_MS));
                let state = handle.state::<AudioState>();

                if state.device_reconnected.swap(false, Ordering::Relaxed) {
                    let _ = engine::reload_current_track(&state);
                    diagnostics::log_native(
                        &handle,
                        "INFO",
                        "[Audio] Device reconnected and reloaded",
                    );
                    handle.emit("audio:device-reconnected", ()).ok();
                }

                if !state.has_track.load(Ordering::Relaxed) {
                    last_pos_ms = 0;
                    last_progress_at = std::time::Instant::now();
                    continue;
                }

                let player_guard = state.player.lock().unwrap();
                if let Some(ref player) = *player_guard {
                    if player.empty() {
                        let suppress_ended =
                            super::engine::now_ms()
                                < state.suppress_ended_until_ms.load(Ordering::Relaxed);
                        if !state.device_error.load(Ordering::Relaxed)
                            && !suppress_ended
                            && !state.ended_notified.swap(true, Ordering::Relaxed)
                        {
                            handle.emit("audio:ended", ()).ok();
                        }
                    } else {
                        let pos = player.get_pos().as_secs_f64();
                        handle.emit("audio:tick", pos).ok();
                        timing::process_lyrics_timeline(&handle, &state, pos);
                        timing::process_comments_timeline(&handle, &state, pos);

                        let playing = !player.is_paused();
                        let pos_ms = player.get_pos().as_millis() as u64;
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
                                "[Audio] Stall detected, reloading current track",
                            );
                            let _ = engine::reload_current_track(&state);
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
