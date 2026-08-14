//! Rust-owned authentication session.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use crate::rt::AppHandle;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
use tokio::sync::RwLock;

use crate::app::diagnostics::log_native;

const SESSION_FILE: &str = "auth_session.json";
const LEGACY_FILE: &str = "sc-auth.json";
const EVENT: &str = "auth:changed";

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct AuthState {
    token: Option<String>,
}

pub struct SessionStore {
    path: PathBuf,
    state: RwLock<AuthState>,
    http: reqwest::Client,
    rt: tokio::runtime::Handle,
}

impl SessionStore {
    pub fn init(
        app_data_dir: PathBuf,
        http: reqwest::Client,
        rt: tokio::runtime::Handle,
    ) -> Arc<Self> {
        let path = app_data_dir.join(SESSION_FILE);
        let state = load_state(&path)
            .or_else(|| migrate_legacy(&app_data_dir.join(LEGACY_FILE), &path))
            .unwrap_or_default();
        Arc::new(Self {
            path,
            state: RwLock::new(state),
            http,
            rt,
        })
    }
}

fn is_usable(token: &str) -> bool {
    !token.is_empty() && token != "undefined" && token != "null"
}

fn load_state(path: &Path) -> Option<AuthState> {
    let bytes = std::fs::read(path).ok()?;
    let state = serde_json::from_slice::<AuthState>(&bytes).ok()?;
    match &state.token {
        Some(token) if is_usable(token) => Some(state),
        _ => None,
    }
}

fn migrate_legacy(legacy: &Path, destination: &Path) -> Option<AuthState> {
    let bytes = std::fs::read(legacy).ok()?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    let token = value.get("state")?.get("sessionId")?.as_str()?.to_string();
    if !is_usable(&token) {
        return None;
    }
    let state = AuthState { token: Some(token) };
    let _ = write_state(destination, &state);
    Some(state)
}

fn write_state(path: &Path, state: &AuthState) -> std::io::Result<()> {
    if state.token.is_none() {
        return match std::fs::remove_file(path) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        };
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec(state).map_err(std::io::Error::other)?;
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    {
        use std::io::Write;
        let mut file = std::fs::File::create(&temporary)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    if let Err(error) = std::fs::rename(&temporary, path) {
        let _ = std::fs::remove_file(&temporary);
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
pub async fn auth_status(state: State<'_, Arc<SessionStore>>) -> Result<AuthState, String> {
    Ok(state.state.read().await.clone())
}

#[tauri::command]
pub async fn auth_set_session(
    token: String,
    app: AppHandle,
    state: State<'_, Arc<SessionStore>>,
) -> Result<(), String> {
    let new_state = AuthState { token: Some(token) };
    let mut guard = state.state.write().await;
    *guard = new_state.clone();
    if let Err(error) = write_state(&state.path, &guard) {
        log_native(&app, "ERROR", format!("[auth] persist failed: {error}"));
    }
    app.emit(EVENT, new_state).ok();
    Ok(())
}

#[tauri::command]
pub async fn auth_logout(
    api_base: String,
    app: AppHandle,
    state: State<'_, Arc<SessionStore>>,
) -> Result<(), String> {
    let old_state = {
        let mut guard = state.state.write().await;
        let old_state = std::mem::take(&mut *guard);
        if let Err(error) = write_state(&state.path, &AuthState::default()) {
            log_native(&app, "ERROR", format!("[auth] clear failed: {error}"));
        }
        app.emit(EVENT, AuthState::default()).ok();
        old_state
    };

    if let Some(token) = old_state.token {
        let http = state.http.clone();
        let app = app.clone();
        state.rt.spawn(async move {
            let url = format!("{}/auth/logout", api_base.trim_end_matches('/'));
            match http
                .post(url)
                .header("x-session-id", token)
                .timeout(Duration::from_secs(10))
                .send()
                .await
            {
                Ok(response) => log_native(
                    &app,
                    "INFO",
                    format!("[auth] server logout {}", response.status()),
                ),
                Err(error) => log_native(
                    &app,
                    "WARN",
                    format!("[auth] server logout failed: {error}"),
                ),
            }
        });
    }
    Ok(())
}
