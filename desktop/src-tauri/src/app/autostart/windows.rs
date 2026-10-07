use std::path::Path;

use windows_registry::{CURRENT_USER, Key};

use super::LOGIN_ARG;

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const APPROVED_KEY: &str =
    "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run";
const VALUE_NAME: &str = "SoundCloud Desktop";

fn command_line(exe: &Path) -> String {
    format!("\"{}\" {LOGIN_ARG}", exe.display())
}

fn registered() -> bool {
    CURRENT_USER
        .open(RUN_KEY)
        .and_then(|key| key.get_string(VALUE_NAME))
        .is_ok()
}

fn disabled_by_user() -> bool {
    CURRENT_USER
        .open(APPROVED_KEY)
        .and_then(|key| key.get_value(VALUE_NAME))
        .is_ok_and(|value| value.first().is_some_and(|state| state & 1 == 1))
}

fn remove_value(key: &Key) -> Result<(), String> {
    if key.get_value(VALUE_NAME).is_err() {
        return Ok(());
    }
    key.remove_value(VALUE_NAME).map_err(|e| e.to_string())
}

fn write_entry(enabled: bool) -> Result<(), String> {
    let run = CURRENT_USER.create(RUN_KEY).map_err(|e| e.to_string())?;
    if let Ok(approved) = CURRENT_USER.options().read().write().open(APPROVED_KEY) {
        remove_value(&approved)?;
    }
    if !enabled {
        return remove_value(&run);
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    run.set_string(VALUE_NAME, command_line(&exe))
        .map_err(|e| e.to_string())
}

pub fn is_enabled() -> bool {
    registered() && !disabled_by_user()
}

pub async fn set_enabled(enabled: bool, _reason: &str) -> Result<(), String> {
    write_entry(enabled)
}

pub fn refresh() -> Result<(), String> {
    if !is_enabled() {
        return Ok(());
    }
    write_entry(true)
}
