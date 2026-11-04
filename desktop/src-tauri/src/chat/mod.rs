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

pub fn start(app: &AppHandle, rt: tokio::runtime::Handle, data_dir: &Path) {
    let state = state::ChatState::new(app.clone(), rt, data_dir.join(DIR));
    runtime::start(&state);
    app.manage(state);
}
