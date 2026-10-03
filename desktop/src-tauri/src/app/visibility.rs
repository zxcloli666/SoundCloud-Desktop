use tauri::Manager;

use crate::rt::{AppHandle, Rt};

pub fn set_page_visible(app: &AppHandle, label: &str, visible: bool) {
    if !cfg!(all(windows, not(feature = "cef"))) {
        return;
    }
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    let webview: &tauri::Webview<Rt> = window.as_ref();
    let _ = if visible {
        webview.show()
    } else {
        webview.hide()
    };
}

pub fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    set_page_visible(app, "main", true);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[tauri::command]
pub async fn show_main_window(app: AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || show_main(&handle));
}
