use std::sync::atomic::Ordering;
use std::path::PathBuf;
use std::time::Duration;

use tauri::State;
use tokio::task;

use crate::audio::decode::{create_player_from_bytes, resolve_normalization_gain};
use crate::audio::state::AudioState;
use crate::audio::types::{AudioLoadResult, MediaCmd, EQ_BANDS};

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

fn volume_to_rodio(v: f64) -> f32 {
    (v / 100.0).clamp(0.0, 2.0) as f32
}

fn stop_current_player(state: &AudioState) {
    suppress_ended_temporarily(state);
    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
}

fn commit_loaded_track(
    state: &AudioState,
    bytes: Vec<u8>,
    new_player: rodio::Player,
    normalization_gain: f32,
) {
    *state.player.lock().unwrap() = Some(new_player);
    *state.source_bytes.lock().unwrap() = Some(bytes);
    *state.normalization_gain.lock().unwrap() = normalization_gain;
    state.has_track.store(true, Ordering::Relaxed);
    state.ended_notified.store(false, Ordering::Relaxed);
    state.device_error.store(false, Ordering::Relaxed);
}

async fn build_player_from_bytes(
    bytes: Vec<u8>,
    mixer: rodio::mixer::Mixer,
    volume: f32,
    normalization_enabled: bool,
    normalization_cache_dir: Option<PathBuf>,
    normalization_cache_key: Option<String>,
    eq_params: std::sync::Arc<std::sync::RwLock<crate::audio::types::EqParams>>,
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
            eq_params,
        )?;
        Ok((bytes, player, duration_secs, normalization_gain))
    })
    .await
    .map_err(|e| format!("audio decode task failed: {e}"))?
}

pub fn reload_current_track(state: &AudioState) -> Result<(), String> {
    suppress_ended_temporarily(state);
    let bytes = state.source_bytes.lock().unwrap().clone();
    let Some(bytes) = bytes else {
        return Ok(());
    };

    let (position, was_paused) = {
        let player = state.player.lock().unwrap();
        let Some(player) = player.as_ref() else {
            return Ok(());
        };
        (player.get_pos(), player.is_paused())
    };

    let mixer = state.mixer.lock().unwrap().clone();
    let vol = *state.volume.lock().unwrap();
    let normalization_enabled = state.normalization_enabled.load(Ordering::Relaxed);
    let normalization_gain = *state.normalization_gain.lock().unwrap();
    let (new_player, _) = create_player_from_bytes(
        &bytes,
        &mixer,
        vol,
        if normalization_enabled { normalization_gain } else { 1.0 },
        state.eq_params.clone(),
    )?;

    if was_paused {
        new_player.pause();
    }
    if position.as_secs_f64() > 0.0 {
        new_player.try_seek(position).ok();
    }

    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
    *player = Some(new_player);
    state.has_track.store(true, Ordering::Relaxed);
    state.ended_notified.store(false, Ordering::Relaxed);
    state.device_error.store(false, Ordering::Relaxed);

    Ok(())
}

pub async fn load_file(
    path: String,
    normalization_cache_dir: Option<PathBuf>,
    normalization_cache_key: Option<String>,
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
        state.eq_params.clone(),
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
    state: State<'_, AudioState>,
) -> Result<AudioLoadResult, String> {
    let generation = state.load_gen.load(Ordering::Relaxed);

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(session_id) = &session_id {
        req = req.header("x-session-id", session_id);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
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
        state.eq_params.clone(),
    )
    .await?;

    commit_loaded_track(&state, bytes, new_player, normalization_gain);

    Ok(AudioLoadResult { duration_secs })
}

pub fn play(state: State<'_, AudioState>) {
    if let Ok(player) = state.player.try_lock() {
        if let Some(ref player) = *player {
            player.play();
        }
    }
}

pub fn pause(state: State<'_, AudioState>) {
    if let Ok(player) = state.player.try_lock() {
        if let Some(ref player) = *player {
            player.pause();
        }
    }
}

pub fn stop(state: State<'_, AudioState>) {
    state.has_track.store(false, Ordering::Relaxed);
    state.load_gen.fetch_add(1, Ordering::Relaxed);
    if let Ok(mut player) = state.player.try_lock() {
        if let Some(old) = player.take() {
            old.stop();
        }
    }
    if let Ok(mut bytes) = state.source_bytes.try_lock() {
        *bytes = None;
    }
}

pub fn seek(position: f64, state: State<'_, AudioState>) -> Result<(), String> {
    suppress_ended_temporarily(&state);
    let target = Duration::from_secs_f64(position);
    let was_paused = state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .map(|player| player.is_paused())
        .unwrap_or(false);

    {
        let player = state.player.lock().unwrap();
        if let Some(ref player) = *player {
            if player.try_seek(target).is_ok() {
                return Ok(());
            }
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
        if normalization_enabled { normalization_gain } else { 1.0 },
        state.eq_params.clone(),
    )?;

    if was_paused {
        new_player.pause();
    }
    if position > 0.0 {
        new_player.try_seek(target).ok();
    }

    let mut player = state.player.lock().unwrap();
    if let Some(old) = player.take() {
        old.stop();
    }
    *player = Some(new_player);
    state.ended_notified.store(false, Ordering::Relaxed);

    if was_paused {
        if let Some(ref player) = *player {
            player.pause();
        }
    }

    Ok(())
}

pub fn set_volume(volume: f64, state: State<'_, AudioState>) {
    let vol = volume_to_rodio(volume);
    *state.volume.lock().unwrap() = vol;
    if let Some(ref player) = *state.player.lock().unwrap() {
        player.set_volume(vol);
    }
}

pub fn get_position(state: State<'_, AudioState>) -> f64 {
    state
        .player
        .lock()
        .unwrap()
        .as_ref()
        .map(|player| player.get_pos().as_secs_f64())
        .unwrap_or(0.0)
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
