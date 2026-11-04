use tauri_plugin_notification::NotificationExt;

use super::alert::Alert;
use crate::chat::badge;
use crate::rt::AppHandle;

#[cfg(target_os = "macos")]
const SOUND: &str = "Tink";
#[cfg(windows)]
const SOUND: &str = "IM";
#[cfg(not(any(target_os = "macos", windows)))]
const SOUND: &str = "message-new-instant";

pub fn show(app: &AppHandle, alert: Alert, sound: bool) {
    let title = alert.title.unwrap_or_else(|| badge::base_title(app));
    let builder = app
        .notification()
        .builder()
        .title(title)
        .body(body_text(&alert.body));
    let builder = if sound { builder.sound(SOUND) } else { builder };
    let _ = builder.show();
}

#[cfg(target_os = "linux")]
fn body_text(body: &str) -> String {
    super::markup::escape(body)
}

#[cfg(not(target_os = "linux"))]
fn body_text(body: &str) -> String {
    body.to_owned()
}
