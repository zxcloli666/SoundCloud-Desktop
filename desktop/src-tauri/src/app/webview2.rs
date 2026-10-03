use std::ffi::c_void;
use std::ptr::null_mut;

use tauri::Manager;

use crate::rt::App;

const DOWNLOAD_PAGE: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";

const CAPTION: &str = "SoundCloud Desktop";

const MESSAGE: &str = r"Microsoft Edge WebView2 Runtime не найден или повреждён, без него SoundCloud Desktop не запустится.

Скачайте Evergreen Standalone Installer со страницы Microsoft и запустите его от имени администратора, Edge для этого не нужен. Если установщик пишет, что Runtime уже установлен, удалите ключи реестра Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5} в HKLM и HKCU и установите заново.

Microsoft Edge WebView2 Runtime is missing or broken, SoundCloud Desktop cannot start without it.

Download the Evergreen Standalone Installer from the Microsoft page and run it as administrator, Edge itself is not needed. If the installer says the Runtime is already installed, delete the Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5} registry keys in HKLM and HKCU and install again.

Открыть страницу загрузки? / Open the download page?";

const MB_YESNO: u32 = 0x04;
const MB_ICONERROR: u32 = 0x10;
const IDYES: i32 = 6;

#[link(name = "user32")]
unsafe extern "system" {
    fn MessageBoxW(hwnd: *mut c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
}

pub fn exit_if_runtime_missing() {
    if tauri::webview_version().is_ok_and(|version| version != "0.0.0") {
        return;
    }
    exit_with_runtime_error();
}

pub fn exit_if_main_window_missing(app: &App) {
    let created = app
        .get_webview_window("main")
        .is_some_and(|window| window.inner_size().is_ok());
    if !created {
        exit_with_runtime_error();
    }
}

fn exit_with_runtime_error() -> ! {
    let text = wide(MESSAGE);
    let caption = wide(CAPTION);
    let answer = unsafe {
        MessageBoxW(
            null_mut(),
            text.as_ptr(),
            caption.as_ptr(),
            MB_YESNO | MB_ICONERROR,
        )
    };
    if answer == IDYES {
        let _ = tauri_plugin_opener::open_url(DOWNLOAD_PAGE, None::<&str>);
    }
    std::process::exit(1);
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}
