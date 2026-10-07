use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

use crate::app::tray;

static QUIT_ON_CLOSE: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseBehavior {
    quit_on_close: bool,
    tray_available: bool,
}

fn current() -> CloseBehavior {
    CloseBehavior {
        quit_on_close: QUIT_ON_CLOSE.load(Ordering::Relaxed),
        tray_available: tray::is_available(),
    }
}

pub fn quits_on_close() -> bool {
    QUIT_ON_CLOSE.load(Ordering::Relaxed) || !tray::is_available()
}

#[tauri::command]
pub fn close_action_get() -> CloseBehavior {
    current()
}

#[tauri::command]
pub fn close_action_set(quit_on_close: bool) -> CloseBehavior {
    QUIT_ON_CLOSE.store(quit_on_close, Ordering::Relaxed);
    current()
}
