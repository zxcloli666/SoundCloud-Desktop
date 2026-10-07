use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{Manager, PhysicalSize};

use crate::rt::{AppHandle, Rt, WebviewWindow};

static MAIN_MINIMIZED: AtomicBool = AtomicBool::new(false);

pub fn set_page_visible(window: &WebviewWindow, visible: bool) {
    if !cfg!(all(windows, not(feature = "cef"))) {
        return;
    }
    let webview: &tauri::Webview<Rt> = window.as_ref();
    let _ = if visible {
        webview.show()
    } else {
        webview.hide()
    };
}

pub fn set_window_page_visible(window: &tauri::Window<Rt>, visible: bool) {
    if let Some(page) = window.get_webview_window(window.label()) {
        set_page_visible(&page, visible);
    }
}

pub fn follow_minimize(window: &tauri::Window<Rt>, size: &PhysicalSize<u32>) {
    let minimized = size.width == 0 && size.height == 0;
    if MAIN_MINIMIZED.swap(minimized, Ordering::Relaxed) != minimized {
        set_window_page_visible(window, !minimized);
    }
}

pub fn show_main(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    set_page_visible(&window, true);
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

#[tauri::command]
pub async fn show_main_window(app: AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || show_main(&handle));
}
