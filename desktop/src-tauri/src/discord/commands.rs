use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use discord_rich_presence::{
    DiscordIpc, DiscordIpcClient,
    activity::{Activity, ActivityType, Assets, Button, StatusDisplayType, Timestamps},
    error::Error as IpcError,
};

use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;
use crate::shared::blocking::run_blocking;
use crate::shared::constants::DISCORD_CLIENT_ID;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Default)]
pub struct DiscordState {
    client: Mutex<Option<DiscordIpcClient>>,
    connecting: AtomicBool,
}

struct ConnectingGuard(Arc<DiscordState>);

impl Drop for ConnectingGuard {
    fn drop(&mut self) {
        self.0.connecting.store(false, Ordering::Release);
    }
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
    status: Option<DiscordRpcStatus>,
    show_button: Option<bool>,
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscordRpcMode {
    Track,
    Artist,
    Activity,
}

#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscordRpcStatus {
    App,
    Track,
    Artist,
}

fn status_display(
    mode: DiscordRpcMode,
    status: DiscordRpcStatus,
    is_playing: bool,
) -> StatusDisplayType {
    match (mode, status) {
        (DiscordRpcMode::Activity, _) | (_, DiscordRpcStatus::App) => StatusDisplayType::Name,
        (DiscordRpcMode::Track, DiscordRpcStatus::Artist) if is_playing => StatusDisplayType::State,
        _ => StatusDisplayType::Details,
    }
}

#[tauri::command]
pub async fn discord_connect(
    app: AppHandle,
    state: tauri::State<'_, Arc<DiscordState>>,
) -> Result<bool, String> {
    if state.connecting.swap(true, Ordering::AcqRel) {
        return Err("Connection in progress".into());
    }
    let guard = ConnectingGuard(state.inner().clone());
    let handle = app.clone();
    let connect = run_blocking(move || open_client(&handle, &guard.0));
    match tokio::time::timeout(CONNECT_TIMEOUT, connect).await {
        Ok(joined) => joined?,
        Err(_) => {
            log_native(&app, "WARN", "[Discord] IPC handshake timed out");
            Err("Connection timed out".into())
        }
    }
}

fn open_client(app: &AppHandle, state: &DiscordState) -> Result<bool, String> {
    if state.client.lock().map_err(|e| e.to_string())?.is_some() {
        return Ok(true);
    }
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    if let Err(e) = client.connect() {
        if !matches!(e, IpcError::IPCNotFound | IpcError::IPCConnectionFailed) {
            log_native(app, "WARN", format!("[Discord] Connection failed: {e:?}"));
        }
        return Err(format!("Connection failed: {e}"));
    }
    *state.client.lock().map_err(|e| e.to_string())? = Some(client);
    log_native(app, "INFO", "[Discord] Connected");
    Ok(true)
}

#[tauri::command]
pub async fn discord_disconnect(state: tauri::State<'_, Arc<DiscordState>>) -> Result<(), String> {
    let state = state.inner().clone();
    run_blocking(move || {
        if let Ok(mut guard) = state.client.lock()
            && let Some(mut client) = guard.take()
        {
            let _ = client.close();
        }
    })
    .await
}

#[tauri::command]
pub async fn discord_set_activity(
    state: tauri::State<'_, Arc<DiscordState>>,
    track: DiscordTrackInfo,
) -> Result<(), String> {
    let state = state.inner().clone();
    run_blocking(move || set_activity(&state, track)).await?
}

fn set_activity(state: &DiscordState, track: DiscordTrackInfo) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    let client = guard.as_mut().ok_or("Discord not connected")?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let elapsed = track.elapsed_secs.unwrap_or(0);
    let start = now - elapsed;
    let is_playing = track.is_playing.unwrap_or(true);
    let mode = track.mode.unwrap_or(DiscordRpcMode::Track);
    let status = track.status.unwrap_or(DiscordRpcStatus::Track);
    let show_button = track.show_button.unwrap_or(true);

    let large_image = track.artwork_url.as_deref().unwrap_or("soundcloud_logo");

    let assets = Assets::new().large_image(large_image);

    let mut activity = Activity::new()
        .activity_type(ActivityType::Listening)
        .status_display_type(status_display(mode, status, is_playing))
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

    if show_button && let Some(ref url) = track.track_url {
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
    run_blocking(move || clear_activity(&state)).await?
}

fn clear_activity(state: &DiscordState) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut client) = *guard {
        let result = client.clear_activity();
        if result.is_err() {
            *guard = None;
        }
        result.map_err(|e| format!("clear_activity: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shown(mode: DiscordRpcMode, status: DiscordRpcStatus, is_playing: bool) -> u8 {
        status_display(mode, status, is_playing) as u8
    }

    #[test]
    fn track_mode_follows_status_choice() {
        assert_eq!(
            shown(DiscordRpcMode::Track, DiscordRpcStatus::Track, true),
            StatusDisplayType::Details as u8
        );
        assert_eq!(
            shown(DiscordRpcMode::Track, DiscordRpcStatus::Artist, true),
            StatusDisplayType::State as u8
        );
        assert_eq!(
            shown(DiscordRpcMode::Track, DiscordRpcStatus::App, true),
            StatusDisplayType::Name as u8
        );
    }

    #[test]
    fn paused_track_never_shows_paused_label_as_artist() {
        assert_eq!(
            shown(DiscordRpcMode::Track, DiscordRpcStatus::Artist, false),
            StatusDisplayType::Details as u8
        );
    }

    #[test]
    fn artist_and_activity_modes() {
        assert_eq!(
            shown(DiscordRpcMode::Artist, DiscordRpcStatus::Track, true),
            StatusDisplayType::Details as u8
        );
        assert_eq!(
            shown(DiscordRpcMode::Artist, DiscordRpcStatus::Artist, false),
            StatusDisplayType::Details as u8
        );
        assert_eq!(
            shown(DiscordRpcMode::Activity, DiscordRpcStatus::Track, true),
            StatusDisplayType::Name as u8
        );
    }
}
