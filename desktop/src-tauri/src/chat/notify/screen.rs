use tauri::{Manager, WindowEvent};

use crate::chat::badge::MAIN_WINDOW;
use crate::rt::AppHandle;

pub fn app_focused(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN_WINDOW)
        .and_then(|window| window.is_focused().ok())
        .unwrap_or(false)
}

pub fn fullscreen(app: &AppHandle) -> bool {
    app.get_webview_window(MAIN_WINDOW)
        .and_then(|window| window.is_fullscreen().ok())
        .unwrap_or(false)
}

pub fn on_focus(app: &AppHandle, focused: fn(&AppHandle)) -> bool {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return false;
    };
    let handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(true) = event {
            focused(&handle);
        }
    });
    true
}
