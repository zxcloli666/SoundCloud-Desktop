pub mod autostart;
pub mod close_action;
pub mod diagnostics;
pub mod hotkeys;
pub mod launch_flags;
pub mod log_sink;
pub mod popover;
pub mod popover_position;
pub mod render_mode;
pub mod restart;
pub mod storage;
pub mod tray;
pub mod updater;
pub mod visibility;
#[cfg(all(windows, not(feature = "cef")))]
pub mod webview2;

pub const APP_IDENTIFIER: &str = "com.soundcloud.desktop";
