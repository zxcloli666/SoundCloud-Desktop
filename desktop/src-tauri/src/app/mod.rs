pub mod autostart;
pub mod close_action;
pub mod desktop_wallpaper;
pub mod diagnostics;
pub mod hotkeys;
pub mod launch_flags;
pub mod log_sink;
pub mod navigation;
pub mod popover;
pub mod popover_position;
pub mod render_mode;
pub mod restart;
pub mod storage;
pub mod themes;
pub mod tray;
mod tray_dot;
pub mod tray_labels;
pub mod updater;
pub mod visibility;
pub mod webview_data;
#[cfg(windows)]
pub mod webview2;

pub const APP_IDENTIFIER: &str = "com.soundcloud.desktop";
