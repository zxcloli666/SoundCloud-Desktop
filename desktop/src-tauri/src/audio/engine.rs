use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::State;
use tokio::task;

use crate::audio::decode::{
    create_player_from_bytes, create_player_from_stream, resolve_normalization_gain,
};
use crate::audio::state::AudioState;
use crate::audio::types::{AudioLoadResult, MediaCmd, EQ_BANDS, STALL_SUPPRESS_MS, TICK_INTERVAL_MS};

const ENDED_SUPPRESS_MS: u64 = 1200;

pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn suppress_ended_temporarily(state: &AudioState) {
    state
        .suppress_ended_until_ms
        .store(now_ms() + ENDED_SUPPRESS_MS, Ordering::Relaxed);
}

/// Mute stall-detection (tick.rs) for a short window. A device switch briefly
/// freezes the old player and the freshly opened output may lag before it starts
/// pulling samples; without this the tick thread reads the gap as a dead stream and
/// fires a redundant reconnect mid-switch.
pub fn suppress_stall_temporarily(state: &AudioState) {
    state
        .suppress_stall_until_ms
        .store(now_ms() + STALL_SUPPRESS_MS, Ordering::Relaxed);
}

fn volume_to_rodio(v: f64) -> f32 {
    (v / 100.0).clamp(0.0, 2.0) as f32
}

fn stop_current_player(state: &AudioState) {
    suppress_ended_temporarily(state);
    if let Some(task) = state.stream_task.lock().unwrap().take() {
        task.abort();
    }
    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
    *state.active_stream.lock().unwrap() = None;
}

fn apply_current_rate(state: &AudioState, player: &rodio::Player) {
    let rate = *state.playback_rate.lock().unwrap();
    if (rate - 1.0).abs() > f32::EPSILON {
        player.set_speed(rate);
    }
}

/// Current playback speed as f64, floored away from zero so it's safe to divide by.
/// rodio's `get_pos()`/`try_seek()` operate in output (wall-clock) time = source/rate;
/// this lets callers convert to/from the source timeline the rest of the app uses.
pub fn current_rate(state: &AudioState) -> f64 {
    (*state.playback_rate.lock().unwrap() as f64).max(0.01)
}

/// Current position in **source seconds**, integrated from rodio's wall-clock get_pos().
/// Exact across mid-track speed changes (each constant-rate segment is closed into the
/// anchor by set_playback_rate). Does NOT lock `state.player` — pass the held player.
pub fn source_pos(state: &AudioState, player: &rodio::Player) -> f64 {
    let rate = current_rate(state);
    let (src_anchor, out_anchor) = *state.pos_anchor.lock().unwrap();
    (src_anchor + (player.get_pos().as_secs_f64() - out_anchor) * rate).max(0.0)
}

/// Re-base the integrator so subsequent get_pos() readings map to source `source`.
/// `output` is the get_pos() value that corresponds to that source position right now.
fn set_pos_anchor(state: &AudioState, source: f64, output: f64) {
    *state.pos_anchor.lock().unwrap() = (source.max(0.0), output.max(0.0));
}

fn commit_loaded_track(
    state: &AudioState,
    bytes: Vec<u8>,
    new_player: rodio::Player,
    normalization_gain: f32,
) {
    apply_current_rate(state, &new_player);
    *state.player.lock().unwrap() = Some(new_player);
    *state.source_bytes.lock().unwrap() = Some(bytes);
    *state.normalization_gain.lock().unwrap() = normalization_gain;
    // Fresh track starts at source 0 / output 0.
    set_pos_anchor(state, 0.0, 0.0);
    state.has_track.store(true, Ordering::Relaxed);
    state.ended_notified.store(false, Ordering::Relaxed);
    state.device_error.store(false, Ordering::Relaxed);
}

pub(crate) fn install_streaming_player(state: &AudioState, new_player: rodio::Player) {
    stop_current_player(state);
    apply_current_rate(state, &new_player);
    *state.player.lock().unwrap() = Some(new_player);
    *state.normalization_gain.lock().unwrap() = 1.0;
    set_pos_anchor(state, 0.0, 0.0);
    state.has_track.store(true, Ordering::Relaxed);
    state.ended_notified.store(false, Ordering::Relaxed);
    state.device_error.store(false, Ordering::Relaxed);
}

pub(crate) fn set_stream_task(state: &AudioState, task: tokio::task::JoinHandle<()>) {
    if let Some(previous) = state.stream_task.lock().unwrap().replace(task) {
        previous.abort();
    }
}

// Все 9 параметров — это один build шаг плеера: mixer/volume/normalization-кеш
// + eq + analyser идут в одну `spawn_blocking`-обертку. Заводить отдельную
// структуру `BuildPlayerArgs` ради одной точки вызова — лишний слой.
#[allow(clippy::too_many_arguments)]
async fn build_player_from_bytes(
    bytes: Vec<u8>,
    mixer: rodio::mixer::Mixer,
    volume: f32,
    normalization_enabled: bool,
    normalization_cache_dir: Option<PathBuf>,
    normalization_cache_key: Option<String>,
    start_paused: bool,
    eq_params: std::sync::Arc<std::sync::RwLock<crate::audio::types::EqParams>>,
    analyser_buffer: std::sync::Arc<crate::audio::analyser::AnalyserBuffer>,
) -> Result<(Vec<u8>, rodio::Player, Option<f64>, f32), String> {
    task::spawn_blocking(move || {
        let normalization_gain = if normalization_enabled {
            resolve_normalization_gain(
                &bytes,
                normalization_cache_dir.as_deref(),
                normalization_cache_key.as_deref(),
            )?
        } else {
            1.0
        };
        let (player, duration_secs) = create_player_from_bytes(
            &bytes,
            &mixer,
            volume,
            normalization_gain,
            start_paused,
            eq_params,
            analyser_buffer,
        )?;
        Ok((bytes, player, duration_secs, normalization_gain))
    })
    .await
    .map_err(|e| format!("audio decode task failed: {e}"))?
}

pub fn reload_current_track(state: &AudioState) -> Result<(), String> {
    suppress_ended_temporarily(state);
    suppress_stall_temporarily(state);
    let bytes = state.source_bytes.lock().unwrap().clone();
    let Some(bytes) = bytes else {
        return Ok(());
    };

    let rate = current_rate(state);
    let (source_position, was_paused) = {
        let player = state.player.lock().unwrap();
        let Some(player) = player.as_ref() else {
            return Ok(());
        };
        (source_pos(state, player), player.is_paused())
    };

    let mixer = state.mixer.lock().unwrap().clone();
    let vol = *state.volume.lock().unwrap();
    let normalization_enabled = state.normalization_enabled.load(Ordering::Relaxed);
    let normalization_gain = *state.normalization_gain.lock().unwrap();
    let (new_player, _) = create_player_from_bytes(
        &bytes,
        &mixer,
        vol,
        if normalization_enabled {
            normalization_gain
        } else {
            1.0
        },
        was_paused,
        state.eq_params.clone(),
        state.analyser_buffer.clone(),
    )?;
    // Apply speed BEFORE seeking so try_seek's argument is interpreted under the speed
    // factor: try_seek(source/rate) lands the decoder at the original source position.
    let output_target = source_position / rate;
    apply_current_rate(state, &new_player);
    if source_position > 0.0 {
        new_player
            .try_seek(Duration::from_secs_f64(output_target))
            .ok();
    }

    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
    *player = Some(new_player);
    set_pos_anchor(state, source_position, output_target);
    state.has_track.store(true, Ordering::Relaxed);
    state.ended_notified.store(false, Ordering::Relaxed);
    state.device_error.store(false, Ordering::Relaxed);

    Ok(())
}

pub async fn load_file(
    path: String,
    normalization_cache_dir: Option<PathBuf>,
    normalization_cache_key: Option<String>,
    start_paused: bool,
    state: State<'_, AudioState>,
) -> Result<AudioLoadResult, String> {
    let bytes = task::spawn_blocking({
        let path = path.clone();
        move || std::fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
    })
    .await
    .map_err(|e| format!("audio file read task failed: {e}"))??;

    stop_current_player(&state);

    let mixer = state.mixer.lock().unwrap().clone();
    let vol = *state.volume.lock().unwrap();
    let normalization_enabled = state.normalization_enabled.load(Ordering::Relaxed);
    let (bytes, new_player, duration_secs, normalization_gain) = build_player_from_bytes(
        bytes,
        mixer,
        vol,
        normalization_enabled,
        normalization_cache_dir,
        normalization_cache_key,
        start_paused,
        state.eq_params.clone(),
        state.analyser_buffer.clone(),
    )
    .await?;

    commit_loaded_track(&state, bytes, new_player, normalization_gain);

    Ok(AudioLoadResult { duration_secs })
}

pub async fn load_url(
    url: String,
    session_id: Option<String>,
    cache_path: Option<String>,
    normalization_cache_dir: Option<PathBuf>,
    normalization_cache_key: Option<String>,
    start_paused: bool,
    state: State<'_, AudioState>,
) -> Result<AudioLoadResult, String> {
    let generation = state.load_gen.load(Ordering::Relaxed);

    const AUDIO_LOAD_CONNECT_TIMEOUT_MS: u64 = 8_000;
    const AUDIO_LOAD_TIMEOUT_MS: u64 = 20_000;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(AUDIO_LOAD_CONNECT_TIMEOUT_MS))
        .timeout(Duration::from_millis(AUDIO_LOAD_TIMEOUT_MS))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let retry_delays = [300u64, 800, 2000];
    let mut last_err = String::new();
    let mut bytes: Vec<u8> = Vec::new();
    let mut success = false;

    for attempt in 0..=retry_delays.len() {
        let mut req = client.get(&url);
        if let Some(sid) = &session_id {
            req = req.header("x-session-id", sid);
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    match resp.bytes().await {
                        Ok(b) => {
                            bytes = b.to_vec();
                            success = true;
                            break;
                        }
                        Err(e) => last_err = e.to_string(),
                    }
                } else if status.as_u16() == 429
                    || (status.as_u16() >= 500 && status.as_u16() <= 599)
                {
                    last_err = format!("HTTP {}", status);
                } else {
                    return Err(format!("HTTP {}", status));
                }
            }
            Err(e) => last_err = e.to_string(),
        }

        if attempt < retry_delays.len() {
            tokio::time::sleep(std::time::Duration::from_millis(retry_delays[attempt])).await;
            if state.load_gen.load(Ordering::Relaxed) != generation {
                return Ok(AudioLoadResult {
                    duration_secs: None,
                });
            }
        }
    }

    if !success {
        return Err(last_err);
    }
    let empty_result = AudioLoadResult {
        duration_secs: None,
    };

    if state.load_gen.load(Ordering::Relaxed) != generation {
        return Ok(empty_result);
    }

    if let Some(path) = cache_path {
        let data = bytes.clone();
        tokio::spawn(async move {
            tokio::fs::write(&path, &data).await.ok();
        });
    }

    stop_current_player(&state);

    if state.load_gen.load(Ordering::Relaxed) != generation {
        return Ok(empty_result);
    }

    let mixer = state.mixer.lock().unwrap().clone();
    let vol = *state.volume.lock().unwrap();
    let normalization_enabled = state.normalization_enabled.load(Ordering::Relaxed);
    let (bytes, new_player, duration_secs, normalization_gain) = build_player_from_bytes(
        bytes,
        mixer,
        vol,
        normalization_enabled,
        normalization_cache_dir,
        normalization_cache_key,
        start_paused,
        state.eq_params.clone(),
        state.analyser_buffer.clone(),
    )
    .await?;

    commit_loaded_track(&state, bytes, new_player, normalization_gain);

    Ok(AudioLoadResult { duration_secs })
}

pub fn play(state: State<'_, AudioState>) {
    // If the device errored (sleep/wake, headphone unplug), reconnect immediately
    // instead of waiting for stall detection (2s delay).
    if state.device_error.load(Ordering::Relaxed) {
        state
            .audio_tx
            .send(crate::audio::types::AudioThreadCmd::Reconnect)
            .ok();
    }
    // Always unpause so reload_current_track sees was_paused=false
    if let Ok(player) = state.player.try_lock()
        && let Some(ref player) = *player {
            player.play();
        }
}

pub fn pause(state: State<'_, AudioState>) {
    if let Ok(player) = state.player.try_lock()
        && let Some(ref player) = *player {
            player.pause();
        }
}

pub fn stop(state: State<'_, AudioState>) {
    state.has_track.store(false, Ordering::Relaxed);
    state.load_gen.fetch_add(1, Ordering::Relaxed);
    if let Ok(mut task) = state.stream_task.try_lock()
        && let Some(task) = task.take()
    {
        task.abort();
    }
    if let Ok(mut player) = state.player.try_lock()
        && let Some(old) = player.take() {
            old.stop();
        }
    if let Ok(mut bytes) = state.source_bytes.try_lock() {
        *bytes = None;
    }
    if let Ok(mut stream) = state.active_stream.try_lock() {
        *stream = None;
    }
}

pub fn seek(position: f64, state: State<'_, AudioState>) -> Result<(), String> {
    suppress_ended_temporarily(&state);
    seek_to(&state, position)
}

/// Seek to `position` (source seconds), trying an in-place decoder seek first and
/// recreating the player when that fails. A bare `try_seek` silently no-ops on
/// decoders that can't seek in place, so any caller that needs the jump to actually
/// take effect (the manual slider, the A-B loop snap-back in tick.rs) must route
/// through here. Takes `&AudioState` so the tick thread can call it without `State`.
pub fn seek_to(state: &AudioState, position: f64) -> Result<(), String> {
    if !position.is_finite() {
        return Err("Invalid seek position".into());
    }

    // `position` is in source seconds (the timeline the whole app uses). rodio's
    // try_seek operates in output time = source/rate on a speed-applied player, so
    // convert before handing it the target.
    let rate = current_rate(state);
    let position = position.max(0.0);
    let output_target = position / rate;
    let target = Duration::from_secs_f64(output_target);
    let was_paused = state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .map(|player| player.is_paused())
        .unwrap_or(false);

    // Never probe a growing decoder in place. Some formats leave the decoder at EOF
    // after an unsupported/out-of-buffer seek; the tick thread then mistakes that
    // for a real track end and advances the queue. Build and seek a candidate player
    // from a fresh reader, and swap it in only after the seek succeeds.
    let has_complete_source = state.source_bytes.lock().unwrap().is_some();
    let active_stream = if has_complete_source {
        None
    } else {
        state.active_stream.lock().unwrap().clone()
    };
    if let Some(active_stream) = active_stream {
        if active_stream.byte_len().is_none() {
            return Err("The stream is still buffering and cannot seek safely yet".into());
        }
        let mixer = state.mixer.lock().unwrap().clone();
        let vol = *state.volume.lock().unwrap();
        let new_player = create_player_from_stream(
            active_stream.reader(),
            active_stream.mime(),
            active_stream.byte_len(),
            &mixer,
            vol,
            true,
            state.eq_params.clone(),
            state.analyser_buffer.clone(),
        )?;
        apply_current_rate(state, &new_player);
        if position > 0.0
            && let Err(error) = new_player.try_seek(target)
        {
            new_player.stop();
            return Err(format!("Seek target is not buffered yet: {error}"));
        }

        let mut player = state.player.lock().unwrap();
        if let Some(old) = player.take() {
            old.stop();
        }
        if !was_paused {
            new_player.play();
        }
        *player = Some(new_player);
        set_pos_anchor(state, position, output_target);
        state.ended_notified.store(false, Ordering::Relaxed);
        return Ok(());
    }

    // For position 0, always recreate the player to avoid decoder state issues
    if position > 0.0 {
        let player = state.player.lock().unwrap();
        if let Some(ref player) = *player
            && player.try_seek(target).is_ok() {
                state.ended_notified.store(false, Ordering::Relaxed);
                set_pos_anchor(state, position, output_target);
                return Ok(());
            }
    }

    let bytes = state.source_bytes.lock().unwrap().clone();
    let Some(bytes) = bytes else {
        return Err("No source to reload for seek".into());
    };

    let mixer = state.mixer.lock().unwrap().clone();
    let vol = *state.volume.lock().unwrap();
    let normalization_enabled = state.normalization_enabled.load(Ordering::Relaxed);
    let normalization_gain = *state.normalization_gain.lock().unwrap();
    let (new_player, _) = create_player_from_bytes(
        &bytes,
        &mixer,
        vol,
        if normalization_enabled {
            normalization_gain
        } else {
            1.0
        },
        was_paused,
        state.eq_params.clone(),
        state.analyser_buffer.clone(),
    )?;
    apply_current_rate(state, &new_player);
    if position > 0.0 {
        new_player.try_seek(target).ok();
    }

    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
    *player = Some(new_player);
    set_pos_anchor(state, position, output_target);
    state.ended_notified.store(false, Ordering::Relaxed);

    Ok(())
}

pub fn set_volume(volume: f64, state: State<'_, AudioState>) {
    let vol = volume_to_rodio(volume);
    *state.volume.lock().unwrap() = vol;
    if let Some(ref player) = *state.player.lock().unwrap() {
        player.set_volume(vol);
    }
}

fn clamp_playback_rate(rate: f64) -> f32 {
    (rate.clamp(0.5, 2.0)) as f32
}

pub fn set_playback_rate(rate: f64, state: State<'_, AudioState>) {
    let value = clamp_playback_rate(rate);
    let player_guard = state.player.lock().unwrap();
    if let Some(ref player) = *player_guard {
        // Close the current constant-rate segment into the integrator BEFORE switching
        // speed, so source-time stays exact across the change (no re-seek, no glitch).
        let old_rate = current_rate(&state);
        let out = player.get_pos().as_secs_f64();
        {
            let mut anchor = state.pos_anchor.lock().unwrap();
            anchor.0 += (out - anchor.1) * old_rate;
            anchor.1 = out;
        }
        *state.playback_rate.lock().unwrap() = value;
        player.set_speed(value);
    } else {
        *state.playback_rate.lock().unwrap() = value;
    }
}

pub fn get_position(state: State<'_, AudioState>) -> f64 {
    state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .map(|player| source_pos(&state, player))
        .unwrap_or(0.0)
}

/// Set or clear the A-B loop region. `a`/`b` are in source seconds; a valid region
/// needs both bounds with `b` meaningfully after `a`. Anything else clears the loop.
pub fn set_ab_loop(a: Option<f64>, b: Option<f64>, state: State<'_, AudioState>) {
    let value = match (a, b) {
        (Some(a), Some(b)) if b > a + 0.05 => Some((a.max(0.0), b)),
        _ => None,
    };
    *state.ab_loop.lock().unwrap() = value;
}

pub fn set_eq(enabled: bool, gains: Vec<f64>, state: State<'_, AudioState>) {
    if let Ok(mut params) = state.eq_params.write() {
        params.enabled = enabled;
        for (index, &gain) in gains.iter().enumerate().take(EQ_BANDS) {
            params.gains[index] = gain.clamp(-12.0, 12.0);
        }
    }
}

pub fn set_normalization(enabled: bool, state: State<'_, AudioState>) {
    state
        .normalization_enabled
        .store(enabled, Ordering::Relaxed);
}

pub fn is_playing(state: State<'_, AudioState>) -> bool {
    state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .map(|player| !player.is_paused() && !player.empty())
        .unwrap_or(false)
}

pub fn set_metadata(
    title: String,
    artist: String,
    cover_url: Option<String>,
    duration_secs: f64,
    state: State<'_, AudioState>,
) {
    if let Some(tx) = state.media_tx.lock().unwrap().as_ref() {
        tx.send(MediaCmd::SetMetadata {
            title,
            artist,
            cover_url,
            duration_secs,
        })
        .ok();
    }
}

pub fn set_playback_state(playing: bool, state: State<'_, AudioState>) {
    if let Some(tx) = state.media_tx.lock().unwrap().as_ref() {
        tx.send(MediaCmd::SetPlaying(playing)).ok();
    }
}

pub fn set_media_position(position: f64, state: State<'_, AudioState>) {
    if let Some(tx) = state.media_tx.lock().unwrap().as_ref() {
        tx.send(MediaCmd::SetPosition(position)).ok();
    }
}

pub async fn save_track_to_path(cache_path: String, dest_path: String) -> Result<String, String> {
    tokio::fs::copy(&cache_path, &dest_path)
        .await
        .map_err(|e| format!("Copy failed: {}", e))?;
    Ok(dest_path)
}

/* ── Hover-preview channel ───────────────────────────────────────
 * A parallel lightweight player on the shared mixer for ~15s on-hover
 * previews. Sources from an already-cached file (reusing track_cache),
 * gets its own throwaway analyser so the main player's spectrum stays
 * intact, and fades via a tick-thread volume ramp (see tick.rs). Never
 * touches the main player or plays history.
 */

fn preview_step(target: f32, fade_ms: u64) -> f32 {
    let ticks = (fade_ms as f32 / TICK_INTERVAL_MS as f32).max(1.0);
    (target / ticks).max(0.0005)
}

/// Start (or replace) the hover preview from a cached file `path` at `volume`
/// (rodio scale 0.0..2.0). The decode runs off-thread. `gen` is a monotonic token
/// from the frontend: an out-of-order (older) decode that finishes after a newer
/// hover installed its preview is dropped. There is no play-side fade-in (the
/// sample starts at target volume); fade-OUT lives in `preview_stop`.
pub async fn preview_play(
    path: String,
    volume: f64,
    r#gen: u64,
    state: State<'_, AudioState>,
) -> Result<(), String> {
    // Cheap pre-check: a hover already superseded by a newer one shouldn't pay for
    // the file read + decode (the authoritative gen check still runs post-decode).
    if r#gen < state.preview.lock().unwrap().r#gen {
        return Ok(());
    }
    let bytes = task::spawn_blocking({
        let path = path.clone();
        move || std::fs::read(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
    })
        .await
        .map_err(|e| format!("preview read task failed: {e}"))??;

    let mixer = state.mixer.lock().unwrap().clone();
    let eq_params = state.eq_params.clone();
    let target = (volume as f32).clamp(0.0, 2.0);
    // Own throwaway analyser buffer — the preview decoder must NOT write into the
    // main player's spectrum buffer. Normalization is skipped (gain 1.0) to keep
    // hover latency low. Build directly at the target volume so the sample is
    // audible the instant it loads (a zero-start + tick fade-in left it silent).
    let analyser = crate::audio::analyser::AnalyserBuffer::new();
    let player = task::spawn_blocking(move || {
        create_player_from_bytes(&bytes, &mixer, target, 1.0, false, eq_params, analyser)
            .map(|(player, _)| player)
    })
        .await
        .map_err(|e| format!("preview decode task failed: {e}"))??;
    player.play();

    let mut preview = state.preview.lock().unwrap();
    // A newer hover already installed its preview — drop this stale decode.
    if r#gen < preview.r#gen {
        player.stop();
        return Ok(());
    }
    if let Some(old) = preview.player.take() {
        old.stop();
    }
    preview.player = Some(player);
    preview.volume = target;
    preview.target = target;
    preview.step = 0.0;
    preview.stop_at_zero = false;
    preview.r#gen = r#gen;
    Ok(())
}

/// Stop the hover preview. `gen == 0` force-stops whatever is playing (unhover /
/// click); a non-zero `gen` is a targeted stale-stop that no-ops unless it still
/// matches the installed preview. With `fade_ms > 0` it fades out (the tick
/// thread drops the player at zero); with 0 it stops immediately.
pub fn preview_stop(fade_ms: u64, r#gen: u64, state: State<'_, AudioState>) {
    let mut preview = state.preview.lock().unwrap();
    if preview.player.is_none() {
        return;
    }
    // Targeted stop for a preview that's already been superseded — ignore.
    if r#gen != 0 && r#gen != preview.r#gen {
        return;
    }
    if fade_ms == 0 {
        if let Some(old) = preview.player.take() {
            old.stop();
        }
        preview.volume = 0.0;
        preview.target = 0.0;
        preview.step = 0.0;
        preview.stop_at_zero = false;
        return;
    }
    preview.step = preview_step(preview.volume.max(0.0005), fade_ms);
    preview.target = 0.0;
    preview.stop_at_zero = true;
}
