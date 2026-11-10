#![cfg_attr(feature = "chat-lab", allow(dead_code))]

pub mod backdrop;
pub mod badge;
pub mod commands;
pub mod download;
pub mod events;
pub mod keychain;
pub mod login;
pub mod media_cache;
pub mod media_scheme;
pub mod notify;
#[cfg(any(windows, test))]
mod relocate;
pub mod runtime;
pub mod state;
pub mod transport;
pub mod upload;

use std::path::Path;
#[cfg(not(feature = "chat-lab"))]
use std::path::PathBuf;

use tauri::Manager;

use crate::rt::AppHandle;

const DEV_BUILD: bool = cfg!(all(debug_assertions, not(feature = "chat-lab")));
const RELEASE_DIR: &str = "chat";
const DEV_DIR: &str = "chat-dev";

pub const DIR: &str = if DEV_BUILD { DEV_DIR } else { RELEASE_DIR };

#[cfg(all(feature = "chat-lab", not(debug_assertions)))]
compile_error!("the chat-lab feature is for dev builds only");

#[cfg(not(feature = "chat-lab"))]
pub fn start(app: &AppHandle, rt: tokio::runtime::Handle, data_dir: &Path) {
    let state = state::ChatState::new(app.clone(), rt, home(app, data_dir));
    runtime::start(&state);
    upload::start(&state);
    app.manage(state);
}

#[cfg(feature = "chat-lab")]
pub fn start(app: &AppHandle, rt: tokio::runtime::Handle, _data_dir: &Path) {
    assert_eq!(
        app.config().identifier,
        crate::app::APP_IDENTIFIER,
        "the chat lab runs only under its own app identifier"
    );
    let dir = std::env::temp_dir().join("soundcloud-chat-lab");
    app.manage(state::ChatState::new(app.clone(), rt, dir));
}

#[cfg(test)]
mod tests;

#[cfg(all(windows, not(feature = "chat-lab")))]
fn home(app: &AppHandle, data_dir: &Path) -> PathBuf {
    let roaming = data_dir.join(DIR);
    match app.path().app_local_data_dir() {
        Ok(local) => relocate::settle(&roaming, &local.join(DIR), &relocate::RealDisk),
        Err(_) => roaming,
    }
}

#[cfg(all(not(windows), not(feature = "chat-lab")))]
fn home(_app: &AppHandle, data_dir: &Path) -> PathBuf {
    data_dir.join(DIR)
}
