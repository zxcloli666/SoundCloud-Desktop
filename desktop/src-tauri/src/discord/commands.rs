use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, Button, Timestamps},
    DiscordIpc, DiscordIpcClient,
};

use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;
use crate::shared::constants::DISCORD_CLIENT_ID;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Default)]
pub struct DiscordState {
    client: Mutex<Option<DiscordIpcClient>>,
    connecting: AtomicBool,
}

#[derive(serde::Deserialize)]
pub struct DiscordTrackInfo {
    title: String,
    artist: String,
    artwork_url: Option<String>,
    track_url: Option<String>,
    duration_secs: Option<i64>,
    elapsed_secs: Option<i64>,
    is_playing: Option<bool>,
    mode: Option<DiscordRpcMode>,
    show_button: Option<bool>,
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscordRpcMode {
    Track,
    Artist,
    Activity,
}

#[tauri::command]
pub async fn discord_connect(
    app: AppHandle,
    state: tauri::State<'_, Arc<DiscordState>>,
) -> Result<bool, String> {
    if state.connecting.swap(true, Ordering::AcqRel) {
        return Err("Connection in progress".into());
    }
    let state = state.inner().clone();
    let connect = tokio::task::spawn_blocking(move || {
        let result = open_client(&state);
        state.connecting.store(false, Ordering::Release);
        result
    });
    match tokio::time::timeout(CONNECT_TIMEOUT, connect).await {
        Ok(joined) => joined.map_err(|e| e.to_string())?,
        Err(_) => {
            log_native(&app, "WARN", "[Discord] IPC handshake timed out");
            Err("Connection timed out".into())
        }
    }
}

fn open_client(state: &DiscordState) -> Result<bool, String> {
    if state.client.lock().map_err(|e| e.to_string())?.is_some() {
        return Ok(true);
    }
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    client
        .connect()
        .map_err(|e| format!("Connection failed: {e}"))?;
    *state.client.lock().map_err(|e| e.to_string())? = Some(client);
    Ok(true)
}

#[tauri::command]
pub async fn discord_disconnect(state: tauri::State<'_, Arc<DiscordState>>) -> Result<(), String> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        if let Ok(mut guard) = state.client.lock()
            && let Some(mut client) = guard.take()
        {
            let _ = client.close();
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn discord_set_activity(
    state: tauri::State<'_, Arc<DiscordState>>,
    track: DiscordTrackInfo,
) -> Result<(), String> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || set_activity(&state, track))
        .await
        .map_err(|e| e.to_string())?
}

fn set_activity(state: &DiscordState, track: DiscordTrackInfo) -> Result<(), String> {
    let mut guard = state.client.try_lock().map_err(|e| e.to_string())?;
    let client = guard.as_mut().ok_or("Discord not connected")?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let elapsed = track.elapsed_secs.unwrap_or(0);
    let start = now - elapsed;
    let is_playing = track.is_playing.unwrap_or(true);
    let mode = track.mode.unwrap_or(DiscordRpcMode::Track);
    let show_button = track.show_button.unwrap_or(true);

    let large_image = track.artwork_url.as_deref().unwrap_or("soundcloud_logo");

    let assets = Assets::new().large_image(large_image);

    let mut activity = Activity::new()
        .activity_type(ActivityType::Listening)
        .assets(assets);

    activity = match mode {
        DiscordRpcMode::Track => activity.details(&track.title).state(if is_playing {
            track.artist.as_str()
        } else {
            "Paused"
        }),
        DiscordRpcMode::Artist => {
            let activity = activity.details(&track.artist);
            if is_playing {
                activity
            } else {
                activity.state("Paused")
            }
        }
        DiscordRpcMode::Activity => {
            if is_playing {
                activity
            } else {
                activity.details("Paused")
            }
        }
    };

    if is_playing {
        let mut timestamps = Timestamps::new().start(start);
        if let Some(dur) = track.duration_secs {
            timestamps = timestamps.end(start + dur);
        }
        activity = activity.timestamps(timestamps);
    }

    if show_button
        && let Some(ref url) = track.track_url {
            activity = activity.buttons(vec![Button::new("Listen on SoundCloud", url)]);
        }

    let result = client.set_activity(activity);

    if result.is_err() {
        *guard = None;
    }

    result.map_err(|e| format!("set_activity: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn discord_clear_activity(
    state: tauri::State<'_, Arc<DiscordState>>,
) -> Result<(), String> {
    let state = state.inner().clone();
    tokio::task::spawn_blocking(move || clear_activity(&state))
        .await
        .map_err(|e| e.to_string())?
}

fn clear_activity(state: &DiscordState) -> Result<(), String> {
    let mut guard = state.client.try_lock().map_err(|e| e.to_string())?;
    if let Some(ref mut client) = *guard {
        client
            .clear_activity()
            .map_err(|e| format!("clear_activity: {e}"))?;
    }
    Ok(())
}
