use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::plugin::TauriPlugin;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::app::diagnostics;
use crate::rt::{AppHandle, Rt};

const PRESSED_EVENT: &str = "hotkey:pressed";
const MAIN_WINDOW: &str = "main";

#[derive(Deserialize)]
pub struct HotkeyBinding {
    action: String,
    accelerator: String,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HotkeyStatus {
    Active,
    Taken,
    Invalid,
}

#[derive(Serialize)]
pub struct HotkeyOutcome {
    action: String,
    status: HotkeyStatus,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HotkeyBackend {
    Native,
    Wayland,
}

pub fn plugin() -> TauriPlugin<Rt> {
    tauri_plugin_global_shortcut::Builder::new().build()
}

#[tauri::command]
pub async fn hotkeys_apply(app: AppHandle, bindings: Vec<HotkeyBinding>) -> Vec<HotkeyOutcome> {
    if let Err(e) = app.global_shortcut().unregister_all() {
        diagnostics::warn(format!("[Hotkeys] unregister failed: {e}"));
    }
    bindings
        .into_iter()
        .map(|binding| HotkeyOutcome {
            status: register(&app, &binding),
            action: binding.action,
        })
        .collect()
}

#[tauri::command]
pub fn hotkeys_backend() -> HotkeyBackend {
    #[cfg(target_os = "linux")]
    {
        let wayland_display = std::env::var_os("WAYLAND_DISPLAY").is_some();
        let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if runs_on_wayland(wayland_display, &session_type) {
            return HotkeyBackend::Wayland;
        }
    }
    HotkeyBackend::Native
}

fn register(app: &AppHandle, binding: &HotkeyBinding) -> HotkeyStatus {
    let Ok(shortcut) = binding.accelerator.parse::<Shortcut>() else {
        return HotkeyStatus::Invalid;
    };
    let action = binding.action.clone();
    let result = app
        .global_shortcut()
        .on_shortcut(shortcut, move |app, _, event| {
            if event.state == ShortcutState::Pressed {
                app.emit_to(MAIN_WINDOW, PRESSED_EVENT, &action).ok();
            }
        });
    match result {
        Ok(()) => HotkeyStatus::Active,
        Err(e) => {
            diagnostics::warn(format!(
                "[Hotkeys] {} ({}) was not registered: {e}",
                binding.action, binding.accelerator
            ));
            HotkeyStatus::Taken
        }
    }
}

#[cfg(any(target_os = "linux", test))]
fn runs_on_wayland(wayland_display: bool, session_type: &str) -> bool {
    wayland_display || session_type.trim().eq_ignore_ascii_case("wayland")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wayland_display_or_session_is_wayland_even_under_xwayland() {
        assert!(runs_on_wayland(true, ""));
        assert!(runs_on_wayland(true, "x11"));
        assert!(runs_on_wayland(false, "Wayland"));
    }

    #[test]
    fn plain_x11_session_is_native() {
        assert!(!runs_on_wayland(false, "x11"));
        assert!(!runs_on_wayland(false, ""));
    }

    #[test]
    fn accelerators_from_the_frontend_parse() {
        for accelerator in [
            "Control+Alt+ArrowRight",
            "Super+Shift+KeyL",
            "Alt+Space",
            "F13",
            "Control+Digit1",
        ] {
            assert!(accelerator.parse::<Shortcut>().is_ok(), "{accelerator}");
        }
        assert!("Control+Alt+Unknown".parse::<Shortcut>().is_err());
    }
}
