use std::path::Path;

use image::RgbaImage;
use tauri::Manager;
use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, GetSystemMetrics, HICON, ICON_BIG, IMAGE_ICON, LR_LOADFROMFILE, LoadImageW,
    SM_CXICON, SM_CYICON, SendMessageW, WM_SETICON,
};
use windows::core::HSTRING;

use super::{ico, shortcuts, shown};
use crate::rt::AppHandle;

const TITLE: u32 = 32;

pub fn show(app: &AppHandle, _chosen: Option<&RgbaImage>) {
    let Some(icon) = shown(app, TITLE) else {
        return;
    };
    for window in app.webview_windows().into_values() {
        let _ = window.set_icon(icon.clone());
    }
}

pub fn install(app: &AppHandle, data_dir: &Path, chosen: Option<&RgbaImage>) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let file = chosen
        .map(|chosen| ico::write(data_dir, chosen))
        .transpose()?;
    set_taskbar_icon(app, file.as_deref());
    let pointed = shortcuts::repoint_all(&exe, file.as_deref().unwrap_or(&exe));
    ico::remove_others(data_dir, file.as_deref());
    pointed
}

fn set_taskbar_icon(app: &AppHandle, file: Option<&Path>) {
    let file = file.map(Path::to_path_buf);
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        for window in handle.webview_windows().into_values() {
            if let Ok(hwnd) = window.hwnd() {
                set_big_icon(hwnd, file.as_deref());
            }
        }
    });
}

fn set_big_icon(hwnd: HWND, file: Option<&Path>) {
    let icon = file.map_or(0, load);
    unsafe {
        let previous = SendMessageW(
            hwnd,
            WM_SETICON,
            Some(WPARAM(ICON_BIG as usize)),
            Some(LPARAM(icon)),
        );
        if previous.0 != 0 {
            let _ = DestroyIcon(HICON(previous.0 as *mut _));
        }
    }
}

fn load(file: &Path) -> isize {
    let loaded = unsafe {
        LoadImageW(
            None,
            &HSTRING::from(file),
            IMAGE_ICON,
            GetSystemMetrics(SM_CXICON),
            GetSystemMetrics(SM_CYICON),
            LR_LOADFROMFILE,
        )
    };
    loaded.map_or(0, |icon| icon.0 as isize)
}
