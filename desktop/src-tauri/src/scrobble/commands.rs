use std::sync::Arc;

use tauri::State;

use super::error::ApiError;
use super::lastfm;
use super::listenbrainz;
use super::state::{ScrobbleState, Service, Status};
use super::store::{Profile, Scrobble};

type Scrobbler<'a> = State<'a, Arc<ScrobbleState>>;

fn clean(mut track: Scrobble) -> Option<Scrobble> {
    track.artist = track.artist.trim().to_owned();
    track.title = track.title.trim().to_owned();
    (!track.artist.is_empty() && !track.title.is_empty()).then_some(track)
}

#[tauri::command]
pub async fn scrobble_status(state: Scrobbler<'_>) -> Result<Status, String> {
    Ok(state.status().await)
}

#[tauri::command]
pub async fn scrobble_refresh(state: Scrobbler<'_>) -> Result<Status, String> {
    Ok(state.refresh_profiles().await)
}

#[tauri::command]
pub async fn scrobble_disconnect(service: Service, state: Scrobbler<'_>) -> Result<Status, String> {
    Ok(state.disconnect(service).await)
}

#[tauri::command]
pub async fn scrobble_now_playing(track: Scrobble, state: Scrobbler<'_>) -> Result<(), String> {
    if let Some(track) = clean(track) {
        state.now_playing(track).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn scrobble_submit(track: Scrobble, state: Scrobbler<'_>) -> Result<(), String> {
    if let Some(track) = clean(track) {
        state.enqueue(track).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn lastfm_auth_start(state: Scrobbler<'_>) -> Result<String, String> {
    let creds = lastfm::credentials().ok_or("unavailable")?;
    let token = lastfm::request_token(&state.http, creds)
        .await
        .map_err(|e| e.to_string())?;
    let url = lastfm::auth_url(creds, &token);
    state.set_lastfm_token(Some(token)).await;
    Ok(url)
}

#[tauri::command]
pub async fn lastfm_auth_finish(state: Scrobbler<'_>) -> Result<Option<Status>, String> {
    let creds = lastfm::credentials().ok_or("unavailable")?;
    let token = state.lastfm_token().await.ok_or("expired")?;
    let (name, key) = match lastfm::session(&state.http, creds, &token).await {
        Ok(session) => session,
        Err(ApiError::Pending) => return Ok(None),
        Err(ApiError::Session) => {
            state.set_lastfm_token(None).await;
            return Err("expired".into());
        }
        Err(e) => return Err(e.to_string()),
    };
    let profile = lastfm::profile(&state.http, creds, &name)
        .await
        .unwrap_or(Profile {
            name,
            ..Profile::default()
        });
    Ok(Some(state.connect_lastfm(key, profile).await))
}

#[tauri::command]
pub async fn lastfm_auth_cancel(state: Scrobbler<'_>) -> Result<(), String> {
    state.set_lastfm_token(None).await;
    Ok(())
}

#[tauri::command]
pub async fn listenbrainz_connect(token: String, state: Scrobbler<'_>) -> Result<Status, String> {
    let token = token.trim().to_owned();
    if token.is_empty() {
        return Err("invalid".into());
    }
    let name = match listenbrainz::validate(&state.http, &token).await {
        Ok(name) => name,
        Err(ApiError::Session | ApiError::Rejected(_)) => return Err("invalid".into()),
        Err(e) => return Err(e.to_string()),
    };
    let profile = listenbrainz::profile(&state.http, &name)
        .await
        .unwrap_or(Profile {
            name,
            ..Profile::default()
        });
    Ok(state.connect_listenbrainz(token, profile).await)
}
