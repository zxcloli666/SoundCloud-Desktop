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
pub mod runtime;
pub mod state;
pub mod transport;
pub mod upload;

use std::path::Path;

use tauri::Manager;

use crate::rt::AppHandle;

pub const DIR: &str = "chat";

#[cfg(all(feature = "chat-lab", not(debug_assertions)))]
compile_error!("the chat-lab feature is for dev builds only");

#[cfg(not(feature = "chat-lab"))]
pub fn start(app: &AppHandle, rt: tokio::runtime::Handle, data_dir: &Path) {
    let state = state::ChatState::new(app.clone(), rt, data_dir.join(DIR));
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
