use std::sync::Arc;
use std::time::Duration;

use tauri::{Manager, WindowEvent};

use super::Runtime;
use crate::app::visibility;
use crate::rt::AppHandle;

const MAIN: &str = "main";
const TICK: Duration = Duration::from_secs(1);

pub fn watch(app: &AppHandle, runtime: Arc<Runtime>, rt: &tokio::runtime::Handle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let focused = runtime.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::Focused(true) = event {
                focused.set_visible(true);
            }
        });
    }
    rt.spawn(async move {
        let mut tick = tokio::time::interval(TICK);
        loop {
            tick.tick().await;
            runtime.set_visible(!visibility::pages_hidden());
        }
    });
}
