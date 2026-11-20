use std::time::Instant;

use tauri::Emitter;

use crate::app::diagnostics;
use crate::rt::AppHandle;

const EVENT: &str = "offline:changed";

#[tauri::command]
pub fn offline_mode_get() -> bool {
    super::on()
}

#[tauri::command]
pub fn offline_mode_set(on: bool) -> bool {
    super::set(on);
    super::on()
}

pub fn forward(app: AppHandle, runtime: &tokio::runtime::Handle) {
    let mut changes = super::watch();
    if super::on() {
        diagnostics::log("INFO", "[Offline] on at start");
    }
    runtime.spawn(async move {
        let mut since = Instant::now();
        while changes.changed().await.is_ok() {
            let on = *changes.borrow_and_update();
            let refused = super::take_refused();
            let line = if on {
                "[Offline] on".to_string()
            } else {
                format!(
                    "[Offline] off after {} s, {refused} requests held back",
                    since.elapsed().as_secs()
                )
            };
            diagnostics::log("INFO", line);
            since = Instant::now();
            let _ = app.emit(EVENT, on);
        }
    });
}
