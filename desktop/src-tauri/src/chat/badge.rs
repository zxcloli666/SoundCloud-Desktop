mod count;
#[cfg(any(target_os = "linux", test))]
mod desktop_entry;
#[cfg(any(windows, test))]
mod glyphs;
#[cfg(target_os = "linux")]
mod launcher;
#[cfg(test)]
mod tests;

use std::sync::{Mutex, Once};

use sc_chat::ChatStatus;
use tauri::{Manager, WindowEvent};

pub use self::count::Badge;
use crate::rt::{AppHandle, WebviewWindow};

pub const MAIN_WINDOW: &str = "main";

static APPLIED: Mutex<Option<Badge>> = Mutex::new(None);
static WATCHING: Once = Once::new();

pub fn apply(app: &AppHandle, status: &ChatStatus) {
    let badge = Badge::from_status(status);
    let Ok(mut applied) = APPLIED.lock() else {
        return;
    };
    if applied.unwrap_or_default() == badge {
        return;
    }
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    WATCHING.call_once(|| reshow_on_focus(app, &window));
    *applied = Some(badge);
    let _ = window.set_title(&badge.title(&base_title(app)));
    show(app, &window, badge);
    crate::app::tray::set_unread(app, badge.count > 0);
}

pub fn has_unread() -> bool {
    APPLIED
        .lock()
        .ok()
        .and_then(|applied| *applied)
        .is_some_and(|badge| badge.count > 0)
}

fn reshow_on_focus(app: &AppHandle, window: &WebviewWindow) {
    let app = app.clone();
    window.on_window_event(move |event| {
        if !matches!(event, WindowEvent::Focused(true)) {
            return;
        }
        let applied = APPLIED.lock().ok().and_then(|applied| *applied);
        if let (Some(badge), Some(window)) = (applied, app.get_webview_window(MAIN_WINDOW)) {
            show(&app, &window, badge);
        }
    });
}

pub fn base_title(app: &AppHandle) -> String {
    app.config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .map(|window| window.title.clone())
        .unwrap_or_else(|| app.package_info().name.clone())
}

#[cfg(target_os = "macos")]
fn show(_app: &AppHandle, window: &WebviewWindow, badge: Badge) {
    let _ = window.set_badge_label(badge.label());
}

#[cfg(windows)]
fn show(_app: &AppHandle, window: &WebviewWindow, badge: Badge) {
    let icon = badge.glyph().map(|glyph| {
        tauri::image::Image::new_owned(glyphs::render(&glyph), glyphs::SIZE, glyphs::SIZE)
    });
    let _ = window.set_overlay_icon(icon);
}

#[cfg(target_os = "linux")]
fn show(app: &AppHandle, _window: &WebviewWindow, badge: Badge) {
    launcher::update(app, badge.count);
}

#[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
fn show(_app: &AppHandle, _window: &WebviewWindow, _badge: Badge) {}
