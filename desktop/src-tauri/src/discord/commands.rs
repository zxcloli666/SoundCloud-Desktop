use std::sync::{Arc, Mutex, mpsc};
use std::time::Duration;

use discord_rich_presence::{
    activity::{Activity, ActivityType, Assets, Button, Timestamps},
    DiscordIpc, DiscordIpcClient,
};

use crate::shared::constants::DISCORD_CLIENT_ID;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
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

fn connect_client() -> Result<DiscordIpcClient, String> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
        let result = client.connect().map(|_| client).map_err(|e| e.to_string());
        let _ = tx.send(result);
    });
    rx.recv_timeout(CONNECT_TIMEOUT)
        .map_err(|_| "timed out".to_string())?
}

#[tauri::command(async)]
pub fn discord_connect(state: tauri::State<'_, Arc<DiscordState>>) -> Result<bool, String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(true);
    }
    match connect_client() {
        Ok(client) => {
            println!("[Discord] Connected");
            *guard = Some(client);
            Ok(true)
        }
        Err(e) => {
            println!("[Discord] Connection failed: {e}");
            Err(format!("Connection failed: {e}"))
        }
    }
}

#[tauri::command(async)]
pub fn discord_disconnect(state: tauri::State<'_, Arc<DiscordState>>) -> Result<(), String> {
    let mut guard = state.client.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut client) = *guard {
        let _ = client.close();
        println!("[Discord] Disconnected");
    }
    *guard = None;
    Ok(())
}

#[tauri::command(async)]
pub fn discord_set_activity(
    state: tauri::State<'_, Arc<DiscordState>>,
    track: DiscordTrackInfo,
) -> Result<(), String> {
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

#[tauri::command(async)]
pub fn discord_clear_activity(state: tauri::State<'_, Arc<DiscordState>>) -> Result<(), String> {
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
